#!/usr/bin/env python3
"""
Parquet Schema Viewer

This script downloads a parquet file from S3 and prints its schema information.
It can be used to quickly inspect the structure of parquet files without having
to download and open them in a data analysis tool.
"""

import argparse
import boto3
import os
import pandas as pd
import sys
import tempfile
from botocore.exceptions import ClientError

# Import pyarrow if available, otherwise provide guidance
try:
    import pyarrow.parquet as pq
except ImportError:
    print("Error: pyarrow package is required. Please install it with:")
    print("  pip install pyarrow")
    print("  or update .projenrc.ts to add pyarrow as a dependency")
    sys.exit(1)


def download_parquet_from_s3(bucket, key, local_path=None):
    """
    Download a parquet file from S3 to a local path.

    Args:
        bucket (str): S3 bucket name
        key (str): S3 object key
        local_path (str, optional): Local path to save the file. If None, uses a temp file.

    Returns:
        str: Path to the downloaded file
    """
    s3_client = boto3.client("s3")

    # Use a temporary file if no local path is provided
    if not local_path:
        fd, local_path = tempfile.mkstemp(suffix=".parquet")
        os.close(fd)

    try:
        print(f"Downloading s3://{bucket}/{key} to {local_path}...")
        s3_client.download_file(bucket, key, local_path)
        return local_path
    except ClientError as e:
        print(f"Error downloading file: {e}")
        raise


def print_parquet_schema(file_path):
    """
    Print the schema of a parquet file.

    Args:
        file_path (str): Path to the parquet file
    """
    try:
        # Read schema using pyarrow
        parquet_file = pq.ParquetFile(file_path)
        schema = parquet_file.schema

        # Print basic file info
        print("\nParquet File Information:")
        print("=" * 60)
        print(f"File path: {file_path}")
        print(f"Number of rows: {parquet_file.metadata.num_rows}")
        print(f"Number of row groups: {parquet_file.num_row_groups}")
        print(f"Number of columns: {len(schema)}")

        # Print schema details
        print("\nSchema:")
        print("=" * 60)
        for i, field in enumerate(schema):
            print(f"{i+1}. {field.name}: {field.physical_type}")

        # Print detailed schema
        print("\nDetailed Schema:")
        print("=" * 60)
        print(schema)

        # Read and print data sample using pandas
        print("\nData Sample (first 5 rows):")
        print("=" * 60)
        df = pd.read_parquet(file_path)
        print(df.head(5).to_string())

        # Print column statistics
        print("\nColumn Statistics:")
        print("=" * 60)
        for col in df.columns:
            print(f"{col}:")
            print(f"  Type: {df[col].dtype}")
            if pd.api.types.is_numeric_dtype(df[col]):
                print(f"  Min: {df[col].min()}")
                print(f"  Max: {df[col].max()}")
                print(f"  Mean: {df[col].mean()}")
            print(f"  Null count: {df[col].isna().sum()}")
            print()

    except Exception as e:
        print(f"Error reading parquet file: {e}")
        sys.exit(1)


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Download and print schema of a parquet file from S3"
    )
    parser.add_argument("--bucket", required=True, help="S3 bucket name")
    parser.add_argument(
        "--key", required=True, help="S3 object key (path to parquet file)"
    )
    parser.add_argument("--output", help="Local path to save the downloaded file")

    args = parser.parse_args()

    # Download the file
    local_file = download_parquet_from_s3(args.bucket, args.key, args.output)

    # Print the schema
    print_parquet_schema(local_file)

    # Clean up temporary file if we created one
    if not args.output and local_file.startswith(tempfile.gettempdir()):
        try:
            os.remove(local_file)
        except OSError as e:
            print(f"Warning: Failed to remove temporary file {local_file}: {e}")


if __name__ == "__main__":
    main()
