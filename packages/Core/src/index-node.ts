declare const global: any;
global._fs = require("fs");
global._path = require("path");
global._crypto = require("crypto");
import { RocksDB } from "./adapters/rocksDB";

try {
    global._rocks = require("rocksdb");
    global._levelup = require("levelup");
    global._encode = require("encoding-down");
    global._lexint = require("lexicographic-integer-encoding")("hex", {strict: true});
    global._rocksAdapter = RocksDB;
} catch (e) { }

import {
    nSQL, nanoSQL, InanoSQLInstance
} from "./index";


export {
    nSQL,
    nanoSQL,
    InanoSQLInstance
};
