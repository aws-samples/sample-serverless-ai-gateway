"""
Tests for the token reservation system to prevent race conditions.
"""

import pytest
import os
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta

from eventhandlers.token_meter import (
    TokenReservationManager,
    TokenLimiter,
    create_ten_minute_period,
    create_monthly_period,
)


class TestTokenReservationManager:
    """Test the TokenReservationManager class."""

    def setup_method(self):
        """Set up test fixtures."""
        # Mock DynamoDB client
        self.mock_dynamodb = Mock()
        self.table_name = "test-token-usage"

        # Set environment variables
        os.environ["TOKEN_USAGE_TABLE"] = self.table_name
        os.environ["DAILY_OUTPUT_LIMIT"] = "20000"
        os.environ["RESERVATION_TTL_MINUTES"] = "10"

        # Create reservation manager with mocked client
        self.reservation_manager = TokenReservationManager(
            dynamodb_client=self.mock_dynamodb,
            table_name=self.table_name,
        )

    def test_create_reservation(self):
        """Test creating a reservation."""
        user_id = "test-user-123"

        # Mock successful put_item
        self.mock_dynamodb.put_item.return_value = {}

        # Create reservation
        reservation_id = self.reservation_manager.create_reservation(user_id)

        # Verify reservation was created
        assert reservation_id is not None
        assert reservation_id.startswith("reservation:daily:")

        # Verify put_item was called
        self.mock_dynamodb.put_item.assert_called_once()
        call_args = self.mock_dynamodb.put_item.call_args
        assert call_args[1]["TableName"] == self.table_name
        assert call_args[1]["Item"]["user_id"]["S"] == user_id
        assert call_args[1]["Item"]["output_tokens"]["N"] == "10000"

    def test_remove_reservation(self):
        """Test removing a reservation."""
        user_id = "test-user-123"
        reservation_id = "reservation:daily:2025-01-08:test-uuid"

        # Mock successful delete_item
        self.mock_dynamodb.delete_item.return_value = {}

        # Remove reservation
        success = self.reservation_manager.remove_reservation(user_id, reservation_id)
        assert success is True

        # Verify delete_item was called
        self.mock_dynamodb.delete_item.assert_called_once()
        call_args = self.mock_dynamodb.delete_item.call_args
        assert call_args[1]["TableName"] == self.table_name
        assert call_args[1]["Key"]["user_id"]["S"] == user_id
        assert call_args[1]["Key"]["period_id"]["S"] == reservation_id

    def test_get_active_reservations(self):
        """Test getting active reservations."""
        user_id = "test-user-123"

        # Mock query response with reservations
        mock_response = {
            "Items": [
                {
                    "period_id": {"S": "reservation:daily:2025-01-08:uuid1"},
                    "output_tokens": {"N": "10000"},
                    "timestamp": {"N": "1704067200"},
                },
                {
                    "period_id": {"S": "reservation:daily:2025-01-08:uuid2"},
                    "output_tokens": {"N": "10000"},
                    "timestamp": {"N": "1704067300"},
                },
            ]
        }
        self.mock_dynamodb.query.return_value = mock_response

        # Get reservations
        reservations = self.reservation_manager.get_active_reservations(user_id)

        # Verify results
        assert len(reservations) == 2
        assert reservations[0]["output_tokens"] == 10000
        assert reservations[1]["output_tokens"] == 10000

    def test_get_total_reserved_tokens(self):
        """Test getting total reserved tokens."""
        user_id = "test-user-123"

        # Mock query response with reservations
        mock_response = {
            "Items": [
                {
                    "period_id": {"S": "reservation:daily:2025-01-08:uuid1"},
                    "output_tokens": {"N": "10000"},
                    "timestamp": {"N": "1704067200"},
                },
                {
                    "period_id": {"S": "reservation:daily:2025-01-08:uuid2"},
                    "output_tokens": {"N": "5000"},
                    "timestamp": {"N": "1704067300"},
                },
            ]
        }
        self.mock_dynamodb.query.return_value = mock_response

        # Get total reserved tokens
        total = self.reservation_manager.get_total_reserved_tokens(user_id)

        # Should sum up all reservations
        assert total == 15000


class TestTokenLimiterWithReservations:
    """Test the TokenLimiter class with reservation functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        # Set environment variables
        os.environ["TOKEN_USAGE_TABLE"] = "test-token-usage"
        os.environ["DAILY_OUTPUT_LIMIT"] = "20000"
        os.environ["DAILY_INPUT_LIMIT"] = "10000"
        os.environ["MONTHLY_OUTPUT_LIMIT"] = "200000"
        os.environ["MONTHLY_INPUT_LIMIT"] = "100000"

    @patch("eventhandlers.token_meter.TokenReservationManager")
    @patch("eventhandlers.token_meter.TokenMeter")
    def test_create_reservation_within_limits(
        self, mock_token_meter, mock_reservation_manager
    ):
        """Test creating a reservation when within limits."""
        user_id = "test-user-123"

        # Mock the meters to return no limits exceeded
        mock_daily_meter = Mock()
        mock_monthly_meter = Mock()
        mock_daily_meter.is_limit_exceeded.return_value = (
            False,
            None,
            {"input_tokens": 0, "output_tokens": 0},
        )
        mock_monthly_meter.is_limit_exceeded.return_value = (
            False,
            None,
            {"input_tokens": 0, "output_tokens": 0},
        )
        mock_daily_meter.name = "10min"
        mock_monthly_meter.name = "monthly"

        # Mock reservation manager
        mock_reservation_manager_instance = Mock()
        mock_reservation_manager_instance.get_total_reserved_tokens.return_value = 0
        mock_reservation_manager_instance.create_reservation.return_value = (
            "reservation:daily:2025-01-08:test-uuid"
        )
        mock_reservation_manager.return_value = mock_reservation_manager_instance

        # Create token limiter with mocked meters
        token_limiter = TokenLimiter(meters=[mock_daily_meter, mock_monthly_meter])

        # Should be able to create reservation when no usage
        reservation_id = token_limiter.create_reservation(user_id)
        assert reservation_id is not None

    @patch("eventhandlers.token_meter.TokenReservationManager")
    @patch("eventhandlers.token_meter.TokenMeter")
    def test_create_reservation_exceeds_limits(
        self, mock_token_meter, mock_reservation_manager
    ):
        """Test creating a reservation when it would exceed limits."""
        user_id = "test-user-123"

        # Mock the meters to return high usage that would exceed limits with reservation
        mock_daily_meter = Mock()
        mock_monthly_meter = Mock()
        mock_daily_meter.is_limit_exceeded.return_value = (
            False,
            None,
            {"input_tokens": 0, "output_tokens": 15000},
        )
        mock_monthly_meter.is_limit_exceeded.return_value = (
            False,
            None,
            {"input_tokens": 0, "output_tokens": 15000},
        )
        mock_daily_meter.name = "10min"
        mock_monthly_meter.name = "monthly"

        # Mock reservation manager
        mock_reservation_manager_instance = Mock()
        mock_reservation_manager_instance.get_total_reserved_tokens.return_value = 0
        mock_reservation_manager.return_value = mock_reservation_manager_instance

        # Create token limiter with mocked meters
        token_limiter = TokenLimiter(meters=[mock_daily_meter, mock_monthly_meter])

        # Should not be able to create reservation (15000 + 0 + 10000 > 20000)
        reservation_id = token_limiter.create_reservation(user_id)
        assert reservation_id is None

    @patch("eventhandlers.token_meter.TokenReservationManager")
    @patch("eventhandlers.token_meter.TokenMeter")
    def test_is_limit_exceeded_with_reservation(
        self, mock_token_meter, mock_reservation_manager
    ):
        """Test limit checking with reservations."""
        user_id = "test-user-123"

        # Mock the meters to return no limits exceeded initially
        mock_daily_meter = Mock()
        mock_monthly_meter = Mock()
        mock_daily_meter.is_limit_exceeded.return_value = (
            False,
            None,
            {"input_tokens": 0, "output_tokens": 0},
        )
        mock_monthly_meter.is_limit_exceeded.return_value = (
            False,
            None,
            {"input_tokens": 0, "output_tokens": 0},
        )
        mock_daily_meter.name = "10min"
        mock_monthly_meter.name = "monthly"

        # Mock reservation manager
        mock_reservation_manager_instance = Mock()
        mock_reservation_manager_instance.get_total_reserved_tokens.return_value = 0
        mock_reservation_manager.return_value = mock_reservation_manager_instance

        # Create token limiter with mocked meters
        token_limiter = TokenLimiter(meters=[mock_daily_meter, mock_monthly_meter])

        # Initially should not exceed limits
        is_exceeded, token_type, period, usage_data = (
            token_limiter.is_limit_exceeded_with_reservation(user_id)
        )
        assert is_exceeded is False

        # Now simulate existing reservations that would cause limit to be exceeded
        mock_reservation_manager_instance.get_total_reserved_tokens.return_value = 15000

        # Should now exceed limits (0 + 15000 + 10000 > 20000)
        is_exceeded, token_type, period, usage_data = (
            token_limiter.is_limit_exceeded_with_reservation(user_id)
        )
        assert is_exceeded is True
        assert token_type == "output"
        assert period == "daily"


if __name__ == "__main__":
    pytest.main([__file__])
