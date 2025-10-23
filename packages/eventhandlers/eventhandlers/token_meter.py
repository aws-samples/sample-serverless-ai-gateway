"""
Copyright 2025 Amazon.com, Inc. and its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License").
You may not use this file except in compliance with the License.
A copy of the License is located at

  http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed
on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
express or implied. See the License for the specific language governing
permissions and limitations under the License.
"""

import boto3
import datetime
import os
import uuid
from typing import Tuple, Dict, List, Optional, Callable, Union, Any

from aws_lambda_powertools import Logger

# Configure structured logging with Powertools
logger = Logger(service="eventhandlers")


def next_month_delta(dt: datetime.datetime) -> datetime.timedelta:
    """Calculate the delta to the end of next month."""
    next_month = dt.replace(day=28) + datetime.timedelta(days=4)
    return next_month.replace(day=1) - dt


def create_ten_minute_period(
    input_limit: Optional[int] = None, output_limit: Optional[int] = None
) -> Dict[str, Any]:
    """Create a 10-minute period configuration for daily limits."""
    return {
        "name": "10min",
        "description": "daily",
        "id_format": lambda dt: f"10min:{dt.strftime('%Y-%m-%d:%H:%M')}",
        "round_time": lambda dt: dt.replace(
            minute=(dt.minute // 10) * 10, second=0, microsecond=0
        ),
        "ttl_delta": datetime.timedelta(days=1),
        "query_window": datetime.timedelta(days=1),
        "input_limit": input_limit or int(os.environ.get("DAILY_INPUT_LIMIT", 10000)),
        "output_limit": output_limit
        or int(os.environ.get("DAILY_OUTPUT_LIMIT", 20000)),
        "prefix": "10min:",
        "aggregate": True,
    }


def create_monthly_period(
    input_limit: Optional[int] = None, output_limit: Optional[int] = None
) -> Dict[str, Any]:
    """Create a monthly period configuration."""
    return {
        "name": "monthly",
        "description": "monthly",
        "id_format": lambda dt: f"monthly:{dt.strftime('%Y-%m')}",
        "round_time": lambda dt: dt.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        ),
        "ttl_delta": next_month_delta,
        "query_window": None,
        "input_limit": input_limit
        or int(os.environ.get("MONTHLY_INPUT_LIMIT", 100000)),
        "output_limit": output_limit
        or int(os.environ.get("MONTHLY_OUTPUT_LIMIT", 200000)),
        "prefix": "monthly:",
        "aggregate": False,
    }


def create_hourly_period(
    input_limit: Optional[int] = None, output_limit: Optional[int] = None
) -> Dict[str, Any]:
    """Create an hourly period configuration."""
    return {
        "name": "hourly",
        "description": "hourly",
        "id_format": lambda dt: f"hourly:{dt.strftime('%Y-%m-%d:%H')}",
        "round_time": lambda dt: dt.replace(minute=0, second=0, microsecond=0),
        "ttl_delta": datetime.timedelta(days=1),
        "query_window": None,
        "input_limit": input_limit or int(os.environ.get("HOURLY_INPUT_LIMIT", 1000)),
        "output_limit": output_limit
        or int(os.environ.get("HOURLY_OUTPUT_LIMIT", 2000)),
        "prefix": "hourly:",
        "aggregate": False,
    }


class TokenMeter:
    """
    A token usage tracking and rate limiting system using DynamoDB.
    Each instance handles a single time period.
    """

    def __init__(
        self,
        period_config: Dict[str, Any],
        dynamodb_client=None,
        table_name: Optional[str] = None,
    ):
        """
        Initialize the TokenMeter with a specific time period configuration.

        Args:
            period_config: Dictionary containing the time period configuration
            dynamodb_client: Optional boto3 DynamoDB client
            table_name: Optional DynamoDB table name (defaults to env var or 'UserTokenUsage')

        The period_config dictionary should contain:
            - name: Name of the period (e.g., '10min', 'monthly')
            - id_format: Function that takes a datetime and returns a period ID string
            - round_time: Function that takes a datetime and rounds it to the period boundary
            - ttl_delta: Timedelta or function that returns the TTL delta for this period
            - query_window: Timedelta for the query window, or None if not applicable
            - input_limit: Maximum input tokens allowed for this period
            - output_limit: Maximum output tokens allowed for this period
            - prefix: String prefix for period IDs of this type
            - aggregate: Boolean indicating if this period requires aggregation
            - description: Human-readable description of this period
        """
        self.dynamodb = dynamodb_client or boto3.client("dynamodb")
        self.table_name = table_name or os.environ.get(
            "TOKEN_USAGE_TABLE", "UserTokenUsage"
        )

        # Validate required keys in period_config
        required_keys = [
            "name",
            "description",
            "id_format",
            "round_time",
            "ttl_delta",
            "input_limit",
            "output_limit",
            "prefix",
            "aggregate",
        ]
        for key in required_keys:
            if key not in period_config:
                raise ValueError(f"Missing required key '{key}' in period_config")

        # Store the period configuration
        self.period_config = period_config
        self.name = period_config["name"]
        self.description = period_config["description"]

    def is_limit_exceeded(
        self, user_id: str
    ) -> Tuple[bool, Optional[str], Dict[str, int]]:
        """
        Check if the user has exceeded token limits for this time period.
        Returns a tuple (is_exceeded, token_type, usage) where:
        - token_type is 'input' or 'output'
        - usage is a dictionary with input_tokens and output_tokens
        """
        usage = self._get_usage(user_id)

        # Validate usage dictionary has required keys
        if "input_tokens" not in usage or "output_tokens" not in usage:
            logger.error("Invalid usage data returned", extra={"usage": usage})
            usage = {"input_tokens": 0, "output_tokens": 0}

        # Check input tokens limit
        if usage["input_tokens"] >= self.period_config["input_limit"]:
            return True, "input", usage

        # Check output tokens limit
        if usage["output_tokens"] >= self.period_config["output_limit"]:
            return True, "output", usage

        return False, None, usage

    def _get_usage(self, user_id: str) -> Dict[str, int]:
        """
        Get token usage for this time period.
        For periods that need aggregation, it will query and aggregate.
        For direct periods, it will query the specific record.
        """
        now = datetime.datetime.now()

        if self.period_config["aggregate"]:
            # This period needs aggregation (like summing 10min windows for daily usage)
            query_window = self.period_config["query_window"]
            if query_window:
                # Calculate the start time for the range query
                start_time = now - query_window
                start_key = f"{self.period_config['prefix']}{start_time.strftime('%Y-%m-%d:%H:%M')}"
                end_key = (
                    f"{self.period_config['prefix']}{now.strftime('%Y-%m-%d:%H:%M')}"
                )

                # Query with a range condition to get only records from the last query_window
                try:
                    response = self.dynamodb.query(
                        TableName=self.table_name,
                        KeyConditionExpression="user_id = :uid AND period_id BETWEEN :start AND :end",
                        ExpressionAttributeValues={
                            ":uid": {"S": user_id},
                            ":start": {"S": start_key},
                            ":end": {"S": end_key},
                        },
                    )
                    # Aggregate the results (no filtering needed as the query handles the time range)
                    return self._sum_period_usage(response.get("Items", []))
                except Exception as e:
                    logger.error(f"Error querying DynamoDB: {e}")
                    return {"input_tokens": 0, "output_tokens": 0}
            else:
                # No query window specified, aggregate all records of this type
                try:
                    response = self.dynamodb.query(
                        TableName=self.table_name,
                        KeyConditionExpression="user_id = :uid AND begins_with(period_id, :prefix)",
                        ExpressionAttributeValues={
                            ":uid": {"S": user_id},
                            ":prefix": {"S": self.period_config["prefix"]},
                        },
                    )
                    return self._sum_period_usage(response.get("Items", []))
                except Exception as e:
                    logger.error(f"Error querying DynamoDB: {e}")
                    return {"input_tokens": 0, "output_tokens": 0}
        else:
            # This is a direct period (like monthly)
            period_id = self.period_config["id_format"](now)

            try:
                response = self.dynamodb.get_item(
                    TableName=self.table_name,
                    Key={"user_id": {"S": user_id}, "period_id": {"S": period_id}},
                )
                item = response.get("Item", {})
                input_tokens = int(item.get("input_tokens", {}).get("N", "0"))
                output_tokens = int(item.get("output_tokens", {}).get("N", "0"))
                return {"input_tokens": input_tokens, "output_tokens": output_tokens}
            except Exception as e:
                logger.error(f"Error getting item from DynamoDB: {e}")
                return {"input_tokens": 0, "output_tokens": 0}

    def _sum_period_usage(self, items: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Sum up token usage from multiple items.
        Used for aggregating usage across multiple time windows.
        """
        total_input = 0
        total_output = 0

        for item in items:
            total_input += int(item.get("input_tokens", {}).get("N", "0"))
            total_output += int(item.get("output_tokens", {}).get("N", "0"))

        return {"input_tokens": total_input, "output_tokens": total_output}

    def update_usage(self, user_id: str, input_tokens: int, output_tokens: int) -> bool:
        """
        Update token usage for this time period.
        Uses DynamoDB's atomic counter feature to increment usage.
        Returns True if the update was successful, False otherwise.
        """
        try:
            now = datetime.datetime.now()

            # Calculate the period ID based on the current time and period configuration
            rounded_time = self.period_config["round_time"](now)
            period_id = self.period_config["id_format"](rounded_time)

            # Calculate TTL based on the period configuration
            if callable(self.period_config["ttl_delta"]):
                ttl_delta = self.period_config["ttl_delta"](now)
            else:
                ttl_delta = self.period_config["ttl_delta"]

            ttl_time = now + ttl_delta
            ttl_value = int(ttl_time.timestamp())

            # Update the record using atomic counters
            self.dynamodb.update_item(
                TableName=self.table_name,
                Key={"user_id": {"S": user_id}, "period_id": {"S": period_id}},
                UpdateExpression="ADD input_tokens :i, output_tokens :o SET #ts = if_not_exists(#ts, :ts), #ttl = :ttl",
                ExpressionAttributeValues={
                    ":i": {"N": str(input_tokens)},
                    ":o": {"N": str(output_tokens)},
                    ":ts": {"N": str(int(now.timestamp()))},
                    ":ttl": {"N": str(ttl_value)},
                },
                ExpressionAttributeNames={"#ts": "timestamp", "#ttl": "ttl"},
            )

            return True
        except Exception as e:
            logger.error(
                "Error updating token usage",
                extra={
                    "error": str(e),
                    "user_id": user_id,
                    "period_id": period_id,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                },
            )
            return False


class TokenLimiter:
    """
    A wrapper class that manages multiple TokenMeter instances for different time periods.
    """

    def __init__(self, meters: Optional[List[TokenMeter]] = None):
        """
        Initialize with a list of TokenMeter instances.
        If none provided, creates default daily and monthly meters.
        """
        if meters is None:
            # Create default meters
            daily_meter = TokenMeter(create_ten_minute_period())
            monthly_meter = TokenMeter(create_monthly_period())
            self.meters = [daily_meter, monthly_meter]
        else:
            self.meters = meters

        # Initialize reservation manager
        self.reservation_manager = TokenReservationManager()

    def is_limit_exceeded(
        self, user_id: str
    ) -> Tuple[bool, Optional[str], Optional[str], Dict[str, int]]:
        """
        Check if the user has exceeded any token limits across all meters.
        Returns a tuple (is_exceeded, token_type, period_description, usage_data) where:
        - is_exceeded: Boolean indicating if any limit is exceeded
        - token_type: 'input' or 'output' indicating which type of token limit was exceeded
        - period_description: Description of the time period (e.g., 'daily', 'monthly')
        - usage_data: Dictionary containing token usage information
        """
        # Initialize usage data with zeros
        total_usage = {
            "input_tokens": 0,
            "output_tokens": 0,
            "monthly_input_tokens": 0,
            "monthly_output_tokens": 0,
            "daily_input_tokens": 0,
            "daily_output_tokens": 0,
        }

        # Check each meter and collect usage data
        for meter in self.meters:
            is_exceeded, token_type, usage = meter.is_limit_exceeded(user_id)

            # Update usage data based on meter type
            if meter.name == "monthly":
                total_usage["monthly_input_tokens"] = usage["input_tokens"]
                total_usage["monthly_output_tokens"] = usage["output_tokens"]
            elif meter.name == "10min":  # This is the daily meter
                total_usage["daily_input_tokens"] = usage["input_tokens"]
                total_usage["daily_output_tokens"] = usage["output_tokens"]

            # Update total usage (use the highest values)
            total_usage["input_tokens"] = max(
                total_usage["input_tokens"], usage["input_tokens"]
            )
            total_usage["output_tokens"] = max(
                total_usage["output_tokens"], usage["output_tokens"]
            )

            if is_exceeded:
                return True, token_type, meter.description, total_usage

        return False, None, None, total_usage

    def update_usage(self, user_id: str, input_tokens: int, output_tokens: int) -> bool:
        """
        Update token usage across all meters.
        Returns True if all updates were successful, False otherwise.
        """
        success = True
        for meter in self.meters:
            if not meter.update_usage(user_id, input_tokens, output_tokens):
                success = False

        return success

    def is_limit_exceeded_with_reservation(
        self, user_id: str
    ) -> Tuple[bool, Optional[str], Optional[str], Dict[str, int]]:
        """
        Check if the user would exceed limits if we create a new reservation.
        This includes checking current usage + existing reservations + new reservation.

        Returns a tuple (is_exceeded, token_type, period_description, usage_data) where:
        - is_exceeded: Boolean indicating if creating a new reservation would exceed limits
        - token_type: 'input' or 'output' indicating which type of token limit would be exceeded
        - period_description: Description of the time period (e.g., 'daily', 'monthly')
        - usage_data: Dictionary containing token usage information including reservations
        """
        # First check regular limits (this gets current usage)
        is_exceeded, token_type, period, usage_data = self.is_limit_exceeded(user_id)

        if is_exceeded:
            return True, token_type, period, usage_data

        # Now check if adding a new reservation would exceed the daily output limit
        # We only apply reservation logic to daily output tokens
        daily_output_limit = int(os.environ.get("DAILY_OUTPUT_LIMIT", 20000))
        reservation_amount = int(daily_output_limit * 0.5)

        # Get current reservations
        total_reserved = self.reservation_manager.get_total_reserved_tokens(user_id)

        # Check if current usage + existing reservations + new reservation > daily limit
        current_daily_output = usage_data.get("daily_output_tokens", 0)
        total_with_new_reservation = (
            current_daily_output + total_reserved + reservation_amount
        )

        if total_with_new_reservation > daily_output_limit:
            # Add reservation info to usage data
            usage_data["total_reserved_tokens"] = total_reserved
            usage_data["new_reservation_amount"] = reservation_amount
            usage_data["total_with_reservation"] = total_with_new_reservation

            logger.info(
                "Reservation would exceed daily output limit",
                extra={
                    "user_id": user_id,
                    "current_daily_output": current_daily_output,
                    "total_reserved": total_reserved,
                    "new_reservation": reservation_amount,
                    "total_with_reservation": total_with_new_reservation,
                    "daily_limit": daily_output_limit,
                },
            )

            return True, "output", "daily", usage_data

        # Add reservation info to usage data for transparency
        usage_data["total_reserved_tokens"] = total_reserved
        usage_data["new_reservation_amount"] = reservation_amount
        usage_data["total_with_reservation"] = total_with_new_reservation

        return False, None, None, usage_data

    def create_reservation(self, user_id: str) -> Optional[str]:
        """
        Create a token reservation if limits allow it.

        Args:
            user_id: The user ID to create the reservation for

        Returns:
            The reservation ID if successful, None if failed or would exceed limits
        """
        # Check if creating a reservation would exceed limits
        is_exceeded, token_type, period, usage_data = (
            self.is_limit_exceeded_with_reservation(user_id)
        )

        if is_exceeded:
            logger.warning(
                "Cannot create reservation - would exceed limits",
                extra={
                    "user_id": user_id,
                    "token_type": token_type,
                    "period": period,
                    "usage_data": usage_data,
                },
            )
            return None

        # Create the reservation
        return self.reservation_manager.create_reservation(user_id)

    def remove_reservation(self, user_id: str, reservation_id: str) -> bool:
        """
        Remove a specific reservation.

        Args:
            user_id: The user ID
            reservation_id: The reservation ID to remove

        Returns:
            True if successful, False otherwise
        """
        return self.reservation_manager.remove_reservation(user_id, reservation_id)

    def get_meter_limits(self) -> Dict[str, int]:
        """
        Returns a dictionary mapping meter names to their input+output limits.
        This is useful for sending limit information to the frontend.
        """
        return {meter.name: meter.period_config["input_limit"] for meter in self.meters}


class TokenReservationManager:
    """
    Manages token reservations to prevent race conditions in concurrent requests.
    Uses the same DynamoDB table as TokenMeter with special reservation period_ids.
    """

    def __init__(self, dynamodb_client=None, table_name: Optional[str] = None):
        """
        Initialize the TokenReservationManager.

        Args:
            dynamodb_client: Optional boto3 DynamoDB client
            table_name: Optional DynamoDB table name (defaults to env var or 'UserTokenUsage')
        """
        self.dynamodb = dynamodb_client or boto3.client("dynamodb")
        self.table_name = table_name or os.environ.get(
            "TOKEN_USAGE_TABLE", "UserTokenUsage"
        )
        self.reservation_ttl_minutes = int(
            os.environ.get("RESERVATION_TTL_MINUTES", "10")
        )

    def create_reservation(self, user_id: str) -> Optional[str]:
        """
        Create a reservation for 50% of the daily output token limit.

        Args:
            user_id: The user ID to create the reservation for

        Returns:
            The reservation ID if successful, None if failed
        """
        try:
            # Get daily output limit (50% reservation)
            daily_output_limit = int(os.environ.get("DAILY_OUTPUT_LIMIT", 20000))
            reservation_amount = int(daily_output_limit * 0.5)

            # Generate unique reservation ID
            reservation_uuid = str(uuid.uuid4())
            now = datetime.datetime.now()
            date_str = now.strftime("%Y-%m-%d")
            reservation_id = f"reservation:daily:{date_str}:{reservation_uuid}"

            # Calculate TTL
            ttl_time = now + datetime.timedelta(minutes=self.reservation_ttl_minutes)
            ttl_value = int(ttl_time.timestamp())

            # Create reservation record
            self.dynamodb.put_item(
                TableName=self.table_name,
                Item={
                    "user_id": {"S": user_id},
                    "period_id": {"S": reservation_id},
                    "input_tokens": {"N": "0"},
                    "output_tokens": {"N": str(reservation_amount)},
                    "timestamp": {"N": str(int(now.timestamp()))},
                    "ttl": {"N": str(ttl_value)},
                },
            )

            logger.info(
                "Created token reservation",
                extra={
                    "user_id": user_id,
                    "reservation_id": reservation_id,
                    "reservation_amount": reservation_amount,
                    "ttl_minutes": self.reservation_ttl_minutes,
                },
            )

            return reservation_id

        except Exception as e:
            logger.error(
                "Error creating token reservation",
                extra={
                    "error": str(e),
                    "user_id": user_id,
                },
            )
            return None

    def remove_reservation(self, user_id: str, reservation_id: str) -> bool:
        """
        Remove a specific reservation.

        Args:
            user_id: The user ID
            reservation_id: The reservation ID to remove

        Returns:
            True if successful, False otherwise
        """
        try:
            self.dynamodb.delete_item(
                TableName=self.table_name,
                Key={
                    "user_id": {"S": user_id},
                    "period_id": {"S": reservation_id},
                },
            )

            logger.info(
                "Removed token reservation",
                extra={
                    "user_id": user_id,
                    "reservation_id": reservation_id,
                },
            )

            return True

        except Exception as e:
            logger.error(
                "Error removing token reservation",
                extra={
                    "error": str(e),
                    "user_id": user_id,
                    "reservation_id": reservation_id,
                },
            )
            return False

    def get_active_reservations(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all active reservations for a user.

        Args:
            user_id: The user ID

        Returns:
            List of reservation records
        """
        try:
            now = datetime.datetime.now()
            date_str = now.strftime("%Y-%m-%d")
            reservation_prefix = f"reservation:daily:{date_str}:"

            response = self.dynamodb.query(
                TableName=self.table_name,
                KeyConditionExpression="user_id = :uid AND begins_with(period_id, :prefix)",
                ExpressionAttributeValues={
                    ":uid": {"S": user_id},
                    ":prefix": {"S": reservation_prefix},
                },
            )

            reservations = []
            for item in response.get("Items", []):
                reservations.append(
                    {
                        "reservation_id": item["period_id"]["S"],
                        "output_tokens": int(
                            item.get("output_tokens", {}).get("N", "0")
                        ),
                        "timestamp": int(item.get("timestamp", {}).get("N", "0")),
                    }
                )

            return reservations

        except Exception as e:
            logger.error(
                "Error getting active reservations",
                extra={
                    "error": str(e),
                    "user_id": user_id,
                },
            )
            return []

    def get_total_reserved_tokens(self, user_id: str) -> int:
        """
        Get the total number of output tokens currently reserved for a user.

        Args:
            user_id: The user ID

        Returns:
            Total reserved output tokens
        """
        reservations = self.get_active_reservations(user_id)
        return sum(r["output_tokens"] for r in reservations)

    def cleanup_expired_reservations(self, user_id: str) -> int:
        """
        Manually cleanup expired reservations for a user.
        Note: TTL should handle this automatically, but this provides manual cleanup.

        Args:
            user_id: The user ID

        Returns:
            Number of reservations cleaned up
        """
        try:
            now = datetime.datetime.now()
            current_timestamp = int(now.timestamp())

            # Get all reservations (not just today's)
            response = self.dynamodb.query(
                TableName=self.table_name,
                KeyConditionExpression="user_id = :uid AND begins_with(period_id, :prefix)",
                ExpressionAttributeValues={
                    ":uid": {"S": user_id},
                    ":prefix": {"S": "reservation:"},
                },
            )

            cleaned_count = 0
            for item in response.get("Items", []):
                ttl_value = int(item.get("ttl", {}).get("N", "0"))
                if ttl_value > 0 and current_timestamp > ttl_value:
                    # This reservation has expired
                    reservation_id = item["period_id"]["S"]
                    if self.remove_reservation(user_id, reservation_id):
                        cleaned_count += 1

            if cleaned_count > 0:
                logger.info(
                    "Cleaned up expired reservations",
                    extra={
                        "user_id": user_id,
                        "cleaned_count": cleaned_count,
                    },
                )

            return cleaned_count

        except Exception as e:
            logger.error(
                "Error cleaning up expired reservations",
                extra={
                    "error": str(e),
                    "user_id": user_id,
                },
            )
            return 0
