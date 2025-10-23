#!/usr/bin/env python3
"""
Response Cache Management Script

A command-line tool for managing the DynamoDB response cache table.
"""

import argparse
import boto3
import hashlib
import json
import os
import sys
import time
from typing import Dict, List, Optional, Any

from eventhandlers.response_cache import ResponseCache


def scan_command(args):
    """Scan the cache table and display entries."""
    cache = ResponseCache(table_name=args.table_name)
    entries = cache.scan_cache(limit=args.limit)

    if not entries:
        print("No entries found in the cache.")
        return

    print(f"Found {len(entries)} entries in the cache:")
    for i, entry in enumerate(entries, 1):
        print(f"\n--- Entry {i} ---")
        print(f"Prompt: {entry['prompt_text'][:100]}...")
        print(f"Response: {entry['response'][:100]}...")

        # Convert TTL to human-readable date
        if entry["ttl"]:
            ttl_date = time.strftime(
                "%Y-%m-%d %H:%M:%S", time.localtime(int(entry["ttl"]))
            )
            print(f"Expires: {ttl_date}")

    if args.output:
        try:
            with open(args.output, "w") as f:
                json.dump(entries, f, indent=2)
            print(f"\nEntries saved to {args.output}")
        except (PermissionError, IOError) as e:
            print(f"Error writing output file: {e}")


def insert_command(args):
    """Insert or update an entry in the cache table."""
    cache = ResponseCache(table_name=args.table_name)

    # Get prompt from file or argument
    prompt = args.prompt
    if args.prompt_file:
        try:
            with open(args.prompt_file, "r") as f:
                prompt = f.read().strip()
        except (FileNotFoundError, PermissionError, IOError) as e:
            print(f"Error reading prompt file: {e}")
            return

    # Get response from file or argument
    response = args.response
    if args.response_file:
        try:
            with open(args.response_file, "r") as f:
                response = f.read().strip()
        except (FileNotFoundError, PermissionError, IOError) as e:
            print(f"Error reading response file: {e}")
            return

    if not prompt or not response:
        print("Error: Both prompt and response must be provided.")
        return

    success = cache.cache_response(prompt, response)
    if success:
        print(f"Successfully added/updated entry for prompt: {prompt[:50]}...")
    else:
        print("Failed to add/update entry.")


def delete_command(args):
    """Delete an entry from the cache table."""
    cache = ResponseCache(table_name=args.table_name)

    # Get prompt from file or argument
    prompt = args.prompt
    if args.prompt_file:
        try:
            with open(args.prompt_file, "r") as f:
                prompt = f.read().strip()
        except (FileNotFoundError, PermissionError, IOError) as e:
            print(f"Error reading prompt file: {e}")
            return

    if not prompt:
        print("Error: Prompt must be provided.")
        return

    success = cache.delete_entry(prompt)
    if success:
        print(f"Successfully deleted entry for prompt: {prompt[:50]}...")
    else:
        print("Failed to delete entry.")


def get_command(args):
    """Get a specific entry from the cache table."""
    cache = ResponseCache(table_name=args.table_name)

    # Get prompt from file or argument
    prompt = args.prompt
    if args.prompt_file:
        try:
            with open(args.prompt_file, "r") as f:
                prompt = f.read().strip()
        except (FileNotFoundError, PermissionError, IOError) as e:
            print(f"Error reading prompt file: {e}")
            return

    if not prompt:
        print("Error: Prompt must be provided.")
        return

    response, _ = cache.get_cached_response(prompt)
    if response:
        print(f"Found entry for prompt: {prompt[:50]}...")
        print("\nResponse:")
        print(response)

        if args.output:
            safe_output_path = os.path.basename(args.output)
            try:
                with open(safe_output_path, "w") as f:
                    f.write(response)
                print(f"\nResponse saved to {safe_output_path}")
            except (PermissionError, IOError) as e:
                print(f"Error writing output file: {e}")
    else:
        print(f"No entry found for prompt: {prompt[:50]}...")


def main():
    parser = argparse.ArgumentParser(
        description="Manage the DynamoDB response cache table."
    )
    parser.add_argument(
        "--table-name", required=True, help="Name of the DynamoDB table"
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Scan command
    scan_parser = subparsers.add_parser("scan", help="Scan the cache table")
    scan_parser.add_argument(
        "--limit", type=int, default=100, help="Maximum number of entries to return"
    )
    scan_parser.add_argument("--output", help="Output file for JSON results")

    # Insert command
    insert_parser = subparsers.add_parser("insert", help="Insert or update an entry")
    insert_parser.add_argument("--prompt", help="The prompt text")
    insert_parser.add_argument("--prompt-file", help="File containing the prompt text")
    insert_parser.add_argument("--response", help="The response text")
    insert_parser.add_argument(
        "--response-file", help="File containing the response text"
    )
    insert_parser.add_argument(
        "--ttl-days", type=int, default=30, help="Time to live in days"
    )

    # Delete command
    delete_parser = subparsers.add_parser("delete", help="Delete an entry")
    delete_parser.add_argument("--prompt", help="The prompt text to delete")
    delete_parser.add_argument(
        "--prompt-file", help="File containing the prompt text to delete"
    )

    # Get command
    get_parser = subparsers.add_parser("get", help="Get a specific entry")
    get_parser.add_argument("--prompt", help="The prompt text to retrieve")
    get_parser.add_argument(
        "--prompt-file", help="File containing the prompt text to retrieve"
    )
    get_parser.add_argument("--output", help="Output file for the response")

    args = parser.parse_args()

    if args.command == "scan":
        scan_command(args)
    elif args.command == "insert":
        insert_command(args)
    elif args.command == "delete":
        delete_command(args)
    elif args.command == "get":
        get_command(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
