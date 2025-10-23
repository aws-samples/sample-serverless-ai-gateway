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
import os
import json
import argparse
from datetime import datetime


current_year = datetime.now().strftime("%Y")

STAR_COMMENT_LICENSE = f"""/**
 * Copyright {current_year} Amazon.com, Inc. and its affiliates. All Rights Reserved.
 *
 * Licensed under the Amazon Software License (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *   http://aws.amazon.com/asl/
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */
"""

HASH_COMMENT_LICENSE = f"""# Copyright {current_year} Amazon.com, Inc. and its affiliates. All Rights Reserved.
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
"""


TEXT_COMMENT_LICENSE = f"""Copyright {current_year} Amazon.com, Inc. and its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License").
You may not use this file except in compliance with the License.
A copy of the License is located at

  http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed
on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
express or implied. See the License for the specific language governing
permissions and limitations under the License.
"""


# Define your license headers for different file types here
LICENSE_HEADERS = {
    ".py": HASH_COMMENT_LICENSE,
    ".ts": STAR_COMMENT_LICENSE,
    ".tsx": STAR_COMMENT_LICENSE,
    ".ipynb": {
        "cell_type": "markdown",
        "metadata": {},
        "source": [s + "\n" for s in TEXT_COMMENT_LICENSE.split("\n")],
    },
    # Add more file types and headers as needed
}


def file_contains_header(filepath, header):
    """
    Checks if the file contains the given header.
    :param filepath: The path to the file.
    :param header: The header to check.
    :return: True if the header is found, False otherwise.
    """
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        # check for old licenses too

        fragments = [
            f"Copyright {year} Amazon.com, Inc. and its affiliate"
            for year in range(2021, int(current_year) + 1)
        ]

        return any([f in content for f in fragments]) or header.strip() in content


def add_license_header(directory, file_extension, license_header):
    """
    Adds a license header to all files with the given extension in the specified directory.
    :param directory: The path to the directory with the files.
    :param file_extension: The extension of the files to add the header to.
    :param license_header: The header to add to the files.
    """
    for subdir, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in ["cdk.out", ".git"]]
        for file in files:
            if file.endswith("vite-env.d.ts"):
                continue

            if file.endswith(file_extension):
                file_path = os.path.join(subdir, file)
                if file_extension != ".ipynb":
                    if not file_contains_header(file_path, license_header):
                        # Handle normal text files
                        with open(file_path, "r+", encoding="utf-8") as f:
                            content = f.read()
                            f.seek(0, 0)
                            f.write(license_header.rstrip("\r\n") + "\n" + content)
                        print(f"Added license header to {file_path}")
                else:
                    # Handle .ipynb files specifically
                    with open(file_path, "r+", encoding="utf-8") as f:
                        notebook = json.load(f)
                        if (
                            notebook["cells"]
                            and notebook["cells"][0]["source"]
                            != license_header["source"]
                        ):
                            notebook["cells"].insert(0, license_header)
                            f.seek(0, 0)
                            json.dump(notebook, f, indent=2, ensure_ascii=False)
                        print(f"Added license header to {file_path}")


def add_license_to_directory(directory):
    """
    Adds a license header to all files in the specified directory based on the file extension.
    :param directory: The path to the directory with the files.
    """
    if not os.path.exists(directory) or not os.path.isdir(directory):
        raise ValueError(f"Directory does not exist or is not a directory: {directory}")
    
    for file_extension, header in LICENSE_HEADERS.items():
        add_license_header(directory, file_extension, header)
        print(f"Checked files with {file_extension} extension for license headers.")


def parse_arguments():
    """
    Parse command line arguments.
    :return: Parsed arguments.
    """
    parser = argparse.ArgumentParser(
        description="Add license headers to files in a directory."
    )
    parser.add_argument(
        "--path", required=True, help="Directory path where the files are located."
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_arguments()
    add_license_to_directory(args.path)
