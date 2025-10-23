# Copyright 2025 Amazon.com, Inc. and its affiliates. All Rights Reserved.
#
# Licensed under the Amazon Software License (the "License").
# You may not use this file except in compliance with the License.
# A copy of the License is located at
#
#   http://aws.amazon.com/asl/
#
# or in the "license" file accompanying this file. This file is distributed
# on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
# express or implied. See the License for the specific language governing
# permissions and limitations under the License.
import json
import pandas as pd
import os
import argparse


def find_file(dir_path, file_name, ignored_dirs=[]):
    """
    Recursively searches for a given file name in a directory and its subdirectories,
    ignoring the specified directories.

    Args:
        dir_path (str): The directory path to search.
        file_name (str): The name of the file to search for.
        ignored_dirs (list): A list of directory names to ignore (default is an empty list).

    Returns:
        list: A list of full paths of the found files.
    """
    found_files = []

    # Check if the current directory should be ignored
    if os.path.basename(dir_path) in ignored_dirs:
        return found_files

    # Check if the file exists in the current directory
    safe_file_name = os.path.basename(file_name)
    full_path = os.path.join(dir_path, safe_file_name)
    if os.path.isfile(full_path):
        found_files.append(full_path)

    # Search in subdirectories
    for item in os.listdir(dir_path):
        item_path = os.path.join(dir_path, item)
        if os.path.isdir(item_path):
            found_files.extend(find_file(item_path, file_name, ignored_dirs))

    return found_files


def read_pnpm_licenses(filename):
    with open(filename) as fh:
        data = json.loads(fh.read())

    return pd.DataFrame([{"package": k, "count": len(data[k])} for k in data.keys()])


def make_df(file):
    with open(file) as fh:
        lc = json.loads(fh.read())
        df = pd.DataFrame(lc["packages"])
        df["file"] = file
        return df


def main():

    # setup argument parsing
    parser = argparse.ArgumentParser(description="Generate license report")
    parser.add_argument(
        "--pnpm-license-file",
    )
    parser.add_argument(
        "--licensecheck-file",
    )
    parser.add_argument("--cwd")
    args = parser.parse_args()

    # change cwd to args.cwd
    os.chdir(args.cwd)

    lcheck_files = find_file(
        ".", args.licensecheck_file, ["node_modules", ".git", ".venv"]
    )

    df_pnpm = read_pnpm_licenses(args.pnpm_license_file)

    print("# Dependency Licenses")

    print("## Summary of NPM packages")
    print()
    print(df_pnpm.to_markdown(index=False))
    print()

    df_lc = pd.concat([make_df(f) for f in lcheck_files])
    df_lc.file = df_lc.file.apply(lambda fn: "/".join(fn.split("/")[2:4]))
    df_lc = df_lc.rename(columns={"license": "License", "file": "Package"})
    df_sum = (
        df_lc.groupby(["Package", "License"])["name"]
        .count()
        .reset_index()
        .rename(columns={"name": "Count"})
        .sort_values(by=["Package", "Count"], ascending=False)
    )

    print("## Summary of Python packages")
    print()

    print(df_sum.to_markdown(index=False))
    print()

    print("## Python packages with GPL licenses")
    print()

    print(df_lc[df_lc.License.str.upper().str.contains("GPL")].to_markdown(index=False))


if __name__ == "__main__":
    main()
