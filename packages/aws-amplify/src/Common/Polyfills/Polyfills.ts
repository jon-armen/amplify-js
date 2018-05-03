/*
 * Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
 * the License. A copy of the License is located at
 *
 *     http://aws.amazon.com/apache2.0/
 *
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
 * and limitations under the License.
 */


import InMemoryCache from '../../Cache/InMemoryCache';

if (!(<any>global).window) {
    (<any>global).window = {
        setTimeout,
        clearTimeout,
        WebSocket: (<any>global).WebSocket,
        ArrayBuffer: (<any>global).ArrayBuffer,
        addEventListener(){ },
        navigator: { onLine: true }
    };
}
if (!(<any>global).localStorage) {
    (<any>global).localStorage = InMemoryCache;
}

(<any>Object).entries = Object.entries || (x => Object.keys(x).map(k => [k, x[k]]));
