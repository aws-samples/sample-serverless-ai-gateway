/**
 * Copyright 2025 Amazon.com, Inc. and its affiliates. All Rights Reserved.
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
 *
 */

export default function Footer() {
    const year = new Date().toISOString().split("-")[0];

    return (
        <div className="fixed bottom-0 left-0 right-0 h-16 p-4 bg-slate-800 text-gray-300 flex flex-row items-center justify-start">
            <img
                src="/prototyping-logo-white.png"
                alt="AWS PACE Prototyping logo"
                className="mr-4 h-auto max-h-[40px] object-contain"
            />
            <a
                target="_blank"
                href="https://aws.amazon.com/"
                className="flex flex-col"
                rel="noreferrer"
            >
                <div>AWS | PACE</div>
                <div className="text-xs">
                    Industries Prototyping and Customer Engineering
                </div>
            </a>
            <div className="flex-1" />
            <div className="text-xs text-right max-w-[220px]">
                Copyright © {year} Amazon Web Services, Inc. or its affiliates.
                All rights reserved.
            </div>
        </div>
    );
}
