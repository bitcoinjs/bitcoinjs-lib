// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = eval('(function() { try { return Module || {} } catch(e) { return {} } })()');

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
    if (Module.hasOwnProperty(key)) {
        moduleOverrides[key] = Module[key];
    }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function';
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (ENVIRONMENT_IS_NODE) {
    // Expose functionality in the same simple way that the shells work
    // Note that we pollute the global namespace here, otherwise we break in node
    if (!Module['print']) Module['print'] = function print(x) {
        process['stdout'].write(x + '\n');
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
        process['stderr'].write(x + '\n');
    };

    var nodeFS = require('fs');
    var nodePath = require('path');

    Module['read'] = function read(filename, binary) {
        filename = nodePath['normalize'](filename);
        var ret = nodeFS['readFileSync'](filename);
        // The path is absolute if the normalized version is the same as the resolved.
        if (!ret && filename != nodePath['resolve'](filename)) {
            filename = path.join(__dirname, '..', 'src', filename);
            ret = nodeFS['readFileSync'](filename);
        }
        if (ret && !binary) ret = ret.toString();
        return ret;
    };

    Module['readBinary'] = function readBinary(filename) { return Module['read'](filename, true) };

    Module['load'] = function load(f) {
        globalEval(read(f));
    };

    Module['arguments'] = process['argv'].slice(2);

    module['exports'] = Module;
}
else if (ENVIRONMENT_IS_SHELL) {
    if (!Module['print']) Module['print'] = print;
    if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

    if (typeof read != 'undefined') {
        Module['read'] = read;
    } else {
        Module['read'] = function read() { throw 'no read() available (jsc?)' };
    }

    Module['readBinary'] = function readBinary(f) {
        return read(f, 'binary');
    };

    if (typeof scriptArgs != 'undefined') {
        Module['arguments'] = scriptArgs;
    } else if (typeof arguments != 'undefined') {
        Module['arguments'] = arguments;
    }

    this['Module'] = Module;

    eval("if (typeof gc === 'function' && gc.toString().indexOf('[native code]') > 0) var gc = undefined"); // wipe out the SpiderMonkey shell 'gc' function, which can confuse closure (uses it as a minified name, and it is then initted to a non-falsey value unexpectedly)
}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    Module['read'] = function read(url) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.send(null);
        return xhr.responseText;
    };

    if (typeof arguments != 'undefined') {
        Module['arguments'] = arguments;
    }

    if (typeof console !== 'undefined') {
        if (!Module['print']) Module['print'] = function print(x) {
            console.log(x);
        };
        if (!Module['printErr']) Module['printErr'] = function printErr(x) {
            console.log(x);
        };
    } else {
        // Probably a worker, and without console.log. We can do very little here...
        var TRY_USE_DUMP = false;
        if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
            dump(x);
        }) : (function(x) {
            // self.postMessage(x); // enable this if you want stdout to be sent as messages
        }));
    }

    if (ENVIRONMENT_IS_WEB) {
        this['Module'] = Module;
    } else {
        Module['load'] = importScripts;
    }
}
else {
    // Unreachable because SHELL is dependant on the others
    throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
    eval.call(null, x);
}
if (!Module['load'] == 'undefined' && Module['read']) {
    Module['load'] = function load(f) {
        globalEval(Module['read'](f));
    };
}
if (!Module['print']) {
    Module['print'] = function(){};
}
if (!Module['printErr']) {
    Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
    Module['arguments'] = [];
}
// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
    if (moduleOverrides.hasOwnProperty(key)) {
        Module[key] = moduleOverrides[key];
    }
}



// === Auto-generated preamble library stuff ===

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
    stackSave: function () {
        return STACKTOP;
    },
    stackRestore: function (stackTop) {
        STACKTOP = stackTop;
    },
    forceAlign: function (target, quantum) {
        quantum = quantum || 4;
        if (quantum == 1) return target;
        if (isNumber(target) && isNumber(quantum)) {
            return Math.ceil(target/quantum)*quantum;
        } else if (isNumber(quantum) && isPowerOfTwo(quantum)) {
            return '(((' +target + ')+' + (quantum-1) + ')&' + -quantum + ')';
        }
        return 'Math.ceil((' + target + ')/' + quantum + ')*' + quantum;
    },
    isNumberType: function (type) {
        return type in Runtime.INT_TYPES || type in Runtime.FLOAT_TYPES;
    },
    isPointerType: function isPointerType(type) {
        return type[type.length-1] == '*';
    },
    isStructType: function isStructType(type) {
        if (isPointerType(type)) return false;
        if (isArrayType(type)) return true;
        if (/<?\{ ?[^}]* ?\}>?/.test(type)) return true; // { i32, i8 } etc. - anonymous struct types
        // See comment in isStructPointerType()
        return type[0] == '%';
    },
    INT_TYPES: {"i1":0,"i8":0,"i16":0,"i32":0,"i64":0},
    FLOAT_TYPES: {"float":0,"double":0},
    or64: function (x, y) {
        var l = (x | 0) | (y | 0);
        var h = (Math.round(x / 4294967296) | Math.round(y / 4294967296)) * 4294967296;
        return l + h;
    },
    and64: function (x, y) {
        var l = (x | 0) & (y | 0);
        var h = (Math.round(x / 4294967296) & Math.round(y / 4294967296)) * 4294967296;
        return l + h;
    },
    xor64: function (x, y) {
        var l = (x | 0) ^ (y | 0);
        var h = (Math.round(x / 4294967296) ^ Math.round(y / 4294967296)) * 4294967296;
        return l + h;
    },
    getNativeTypeSize: function (type) {
        switch (type) {
            case 'i1': case 'i8': return 1;
            case 'i16': return 2;
            case 'i32': return 4;
            case 'i64': return 8;
            case 'float': return 4;
            case 'double': return 8;
            default: {
                if (type[type.length-1] === '*') {
                    return Runtime.QUANTUM_SIZE; // A pointer
                } else if (type[0] === 'i') {
                    var bits = parseInt(type.substr(1));
                    assert(bits % 8 === 0);
                    return bits/8;
                } else {
                    return 0;
                }
            }
        }
    },
    getNativeFieldSize: function (type) {
        return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
    },
    dedup: function dedup(items, ident) {
        var seen = {};
        if (ident) {
            return items.filter(function(item) {
                if (seen[item[ident]]) return false;
                seen[item[ident]] = true;
                return true;
            });
        } else {
            return items.filter(function(item) {
                if (seen[item]) return false;
                seen[item] = true;
                return true;
            });
        }
    },
    set: function set() {
        var args = typeof arguments[0] === 'object' ? arguments[0] : arguments;
        var ret = {};
        for (var i = 0; i < args.length; i++) {
            ret[args[i]] = 0;
        }
        return ret;
    },
    STACK_ALIGN: 8,
    getAlignSize: function (type, size, vararg) {
        // we align i64s and doubles on 64-bit boundaries, unlike x86
        if (!vararg && (type == 'i64' || type == 'double')) return 8;
        if (!type) return Math.min(size, 8); // align structures internally to 64 bits
        return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
    },
    calculateStructAlignment: function calculateStructAlignment(type) {
        type.flatSize = 0;
        type.alignSize = 0;
        var diffs = [];
        var prev = -1;
        var index = 0;
        type.flatIndexes = type.fields.map(function(field) {
            index++;
            var size, alignSize;
            if (Runtime.isNumberType(field) || Runtime.isPointerType(field)) {
                size = Runtime.getNativeTypeSize(field); // pack char; char; in structs, also char[X]s.
                alignSize = Runtime.getAlignSize(field, size);
            } else if (Runtime.isStructType(field)) {
                if (field[1] === '0') {
                    // this is [0 x something]. When inside another structure like here, it must be at the end,
                    // and it adds no size
                    // XXX this happens in java-nbody for example... assert(index === type.fields.length, 'zero-length in the middle!');
                    size = 0;
                    if (Types.types[field]) {
                        alignSize = Runtime.getAlignSize(null, Types.types[field].alignSize);
                    } else {
                        alignSize = type.alignSize || QUANTUM_SIZE;
                    }
                } else {
                    size = Types.types[field].flatSize;
                    alignSize = Runtime.getAlignSize(null, Types.types[field].alignSize);
                }
            } else if (field[0] == 'b') {
                // bN, large number field, like a [N x i8]
                size = field.substr(1)|0;
                alignSize = 1;
            } else if (field[0] === '<') {
                // vector type
                size = alignSize = Types.types[field].flatSize; // fully aligned
            } else if (field[0] === 'i') {
                // illegal integer field, that could not be legalized because it is an internal structure field
                // it is ok to have such fields, if we just use them as markers of field size and nothing more complex
                size = alignSize = parseInt(field.substr(1))/8;
                assert(size % 1 === 0, 'cannot handle non-byte-size field ' + field);
            } else {
                assert(false, 'invalid type for calculateStructAlignment');
            }
            if (type.packed) alignSize = 1;
            type.alignSize = Math.max(type.alignSize, alignSize);
            var curr = Runtime.alignMemory(type.flatSize, alignSize); // if necessary, place this on aligned memory
            type.flatSize = curr + size;
            if (prev >= 0) {
                diffs.push(curr-prev);
            }
            prev = curr;
            return curr;
        });
        if (type.name_ && type.name_[0] === '[') {
            // arrays have 2 elements, so we get the proper difference. then we scale here. that way we avoid
            // allocating a potentially huge array for [999999 x i8] etc.
            type.flatSize = parseInt(type.name_.substr(1))*type.flatSize/2;
        }
        type.flatSize = Runtime.alignMemory(type.flatSize, type.alignSize);
        if (diffs.length == 0) {
            type.flatFactor = type.flatSize;
        } else if (Runtime.dedup(diffs).length == 1) {
            type.flatFactor = diffs[0];
        }
        type.needsFlattening = (type.flatFactor != 1);
        return type.flatIndexes;
    },
    generateStructInfo: function (struct, typeName, offset) {
        var type, alignment;
        if (typeName) {
            offset = offset || 0;
            type = (typeof Types === 'undefined' ? Runtime.typeInfo : Types.types)[typeName];
            if (!type) return null;
            if (type.fields.length != struct.length) {
                printErr('Number of named fields must match the type for ' + typeName + ': possibly duplicate struct names. Cannot return structInfo');
                return null;
            }
            alignment = type.flatIndexes;
        } else {
            var type = { fields: struct.map(function(item) { return item[0] }) };
            alignment = Runtime.calculateStructAlignment(type);
        }
        var ret = {
            __size__: type.flatSize
        };
        if (typeName) {
            struct.forEach(function(item, i) {
                if (typeof item === 'string') {
                    ret[item] = alignment[i] + offset;
                } else {
                    // embedded struct
                    var key;
                    for (var k in item) key = k;
                    ret[key] = Runtime.generateStructInfo(item[key], type.fields[i], alignment[i]);
                }
            });
        } else {
            struct.forEach(function(item, i) {
                ret[item[1]] = alignment[i];
            });
        }
        return ret;
    },
    dynCall: function (sig, ptr, args) {
        if (args && args.length) {
            if (!args.splice) args = Array.prototype.slice.call(args);
            args.splice(0, 0, ptr);
            return Module['dynCall_' + sig].apply(null, args);
        } else {
            return Module['dynCall_' + sig].call(null, ptr);
        }
    },
    functionPointers: [],
    addFunction: function (func) {
        for (var i = 0; i < Runtime.functionPointers.length; i++) {
            if (!Runtime.functionPointers[i]) {
                Runtime.functionPointers[i] = func;
                return 2*(1 + i);
            }
        }
        throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
    },
    removeFunction: function (index) {
        Runtime.functionPointers[(index-2)/2] = null;
    },
    getAsmConst: function (code, numArgs) {
        // code is a constant string on the heap, so we can cache these
        if (!Runtime.asmConstCache) Runtime.asmConstCache = {};
        var func = Runtime.asmConstCache[code];
        if (func) return func;
        var args = [];
        for (var i = 0; i < numArgs; i++) {
            args.push(String.fromCharCode(36) + i); // $0, $1 etc
        }
        code = Pointer_stringify(code);
        if (code[0] === '"') {
            // tolerate EM_ASM("..code..") even though EM_ASM(..code..) is correct
            if (code.indexOf('"', 1) === code.length-1) {
                code = code.substr(1, code.length-2);
            } else {
                // something invalid happened, e.g. EM_ASM("..code($0)..", input)
                abort('invalid EM_ASM input |' + code + '|. Please use EM_ASM(..code..) (no quotes) or EM_ASM({ ..code($0).. }, input) (to input values)');
            }
        }
        return Runtime.asmConstCache[code] = eval('(function(' + args.join(',') + '){ ' + code + ' })'); // new Function does not allow upvars in node
    },
    warnOnce: function (text) {
        if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
        if (!Runtime.warnOnce.shown[text]) {
            Runtime.warnOnce.shown[text] = 1;
            Module.printErr(text);
        }
    },
    funcWrappers: {},
    getFuncWrapper: function (func, sig) {
        assert(sig);
        if (!Runtime.funcWrappers[func]) {
            Runtime.funcWrappers[func] = function dynCall_wrapper() {
                return Runtime.dynCall(sig, func, arguments);
            };
        }
        return Runtime.funcWrappers[func];
    },
    UTF8Processor: function () {
        var buffer = [];
        var needed = 0;
        this.processCChar = function (code) {
            code = code & 0xFF;

            if (buffer.length == 0) {
                if ((code & 0x80) == 0x00) {        // 0xxxxxxx
                    return String.fromCharCode(code);
                }
                buffer.push(code);
                if ((code & 0xE0) == 0xC0) {        // 110xxxxx
                    needed = 1;
                } else if ((code & 0xF0) == 0xE0) { // 1110xxxx
                    needed = 2;
                } else {                            // 11110xxx
                    needed = 3;
                }
                return '';
            }

            if (needed) {
                buffer.push(code);
                needed--;
                if (needed > 0) return '';
            }

            var c1 = buffer[0];
            var c2 = buffer[1];
            var c3 = buffer[2];
            var c4 = buffer[3];
            var ret;
            if (buffer.length == 2) {
                ret = String.fromCharCode(((c1 & 0x1F) << 6)  | (c2 & 0x3F));
            } else if (buffer.length == 3) {
                ret = String.fromCharCode(((c1 & 0x0F) << 12) | ((c2 & 0x3F) << 6)  | (c3 & 0x3F));
            } else {
                // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                var codePoint = ((c1 & 0x07) << 18) | ((c2 & 0x3F) << 12) |
                    ((c3 & 0x3F) << 6)  | (c4 & 0x3F);
                ret = String.fromCharCode(
                    Math.floor((codePoint - 0x10000) / 0x400) + 0xD800,
                    (codePoint - 0x10000) % 0x400 + 0xDC00);
            }
            buffer.length = 0;
            return ret;
        }
        this.processJSString = function processJSString(string) {
            string = unescape(encodeURIComponent(string));
            var ret = [];
            for (var i = 0; i < string.length; i++) {
                ret.push(string.charCodeAt(i));
            }
            return ret;
        }
    },
    getCompilerSetting: function (name) {
        throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
    },
    stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+7)&-8); return ret; },
    staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = (((STATICTOP)+7)&-8); return ret; },
    dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + size)|0;DYNAMICTOP = (((DYNAMICTOP)+7)&-8); if (DYNAMICTOP >= TOTAL_MEMORY) enlargeMemory();; return ret; },
    alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 8))*(quantum ? quantum : 8); return ret; },
    makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*(+4294967296))) : ((+((low>>>0)))+((+((high|0)))*(+4294967296)))); return ret; },
    GLOBAL_BASE: 8,
    QUANTUM_SIZE: 4,
    __dummy__: 0
}


Module['Runtime'] = Runtime;









//========================================
// Runtime essentials
//========================================

var __THREW__ = 0; // Used in checking for thrown exceptions.

var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

var undef = 0;
// tempInt is used for 32-bit signed values or smaller. tempBigInt is used
// for 32-bit unsigned values or more than 32 bits. TODO: audit all uses of tempInt
var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD, tempDouble, tempFloat;
var tempI64, tempI64b;
var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;

function assert(condition, text) {
    if (!condition) {
        abort('Assertion failed: ' + text);
    }
}

var globalScope = this;

// C calling interface. A convenient way to call C functions (in C files, or
// defined with extern "C").
//
// Note: LLVM optimizations can inline and remove functions, after which you will not be
//       able to call them. Closure can also do so. To avoid that, add your function to
//       the exports using something like
//
//         -s EXPORTED_FUNCTIONS='["_main", "_myfunc"]'
//
// @param ident      The name of the C function (note that C++ functions will be name-mangled - use extern "C")
// @param returnType The return type of the function, one of the JS types 'number', 'string' or 'array' (use 'number' for any C pointer, and
//                   'array' for JavaScript arrays and typed arrays; note that arrays are 8-bit).
// @param argTypes   An array of the types of arguments for the function (if there are no arguments, this can be ommitted). Types are as in returnType,
//                   except that 'array' is not possible (there is no way for us to know the length of the array)
// @param args       An array of the arguments to the function, as native JS values (as in returnType)
//                   Note that string arguments will be stored on the stack (the JS string will become a C string on the stack).
// @return           The return value, as a native JS value (as in returnType)
function ccall(ident, returnType, argTypes, args) {
    return ccallFunc(getCFunc(ident), returnType, argTypes, args);
}
Module["ccall"] = ccall;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
    try {
        var func = Module['_' + ident]; // closure exported function
        if (!func) func = eval('_' + ident); // explicit lookup
    } catch(e) {
    }
    assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
    return func;
}

// Internal function that does a C call using a function, not an identifier
function ccallFunc(func, returnType, argTypes, args) {
    var stack = 0;
    function toC(value, type) {
        if (type == 'string') {
            if (value === null || value === undefined || value === 0) return 0; // null string
            value = intArrayFromString(value);
            type = 'array';
        }
        if (type == 'array') {
            if (!stack) stack = Runtime.stackSave();
            var ret = Runtime.stackAlloc(value.length);
            writeArrayToMemory(value, ret);
            return ret;
        }
        return value;
    }
    function fromC(value, type) {
        if (type == 'string') {
            return Pointer_stringify(value);
        }
        assert(type != 'array');
        return value;
    }
    var i = 0;
    var cArgs = args ? args.map(function(arg) {
        return toC(arg, argTypes[i++]);
    }) : [];
    var ret = fromC(func.apply(null, cArgs), returnType);
    if (stack) Runtime.stackRestore(stack);
    return ret;
}

// Returns a native JS wrapper for a C function. This is similar to ccall, but
// returns a function you can call repeatedly in a normal way. For example:
//
//   var my_function = cwrap('my_c_function', 'number', ['number', 'number']);
//   alert(my_function(5, 22));
//   alert(my_function(99, 12));
//
function cwrap(ident, returnType, argTypes) {
    var func = getCFunc(ident);
    return function() {
        return ccallFunc(func, returnType, argTypes, Array.prototype.slice.call(arguments));
    }
}
Module["cwrap"] = cwrap;

// Sets a value in memory in a dynamic way at run-time. Uses the
// type data. This is the same as makeSetValue, except that
// makeSetValue is done at compile-time and generates the needed
// code then, whereas this function picks the right code at
// run-time.
// Note that setValue and getValue only do *aligned* writes and reads!
// Note that ccall uses JS types as for defining types, while setValue and
// getValue need LLVM types ('i8', 'i32') - this is a lower-level operation
function setValue(ptr, value, type, noSafe) {
    type = type || 'i8';
    if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
        case 'i1': HEAP8[(ptr)]=value; break;
        case 'i8': HEAP8[(ptr)]=value; break;
        case 'i16': HEAP16[((ptr)>>1)]=value; break;
        case 'i32': HEAP32[((ptr)>>2)]=value; break;
        case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= (+1) ? (tempDouble > (+0) ? ((Math_min((+(Math_floor((tempDouble)/(+4294967296)))), (+4294967295)))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/(+4294967296))))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
        case 'float': HEAPF32[((ptr)>>2)]=value; break;
        case 'double': HEAPF64[((ptr)>>3)]=value; break;
        default: abort('invalid type for setValue: ' + type);
    }
}
Module['setValue'] = setValue;

// Parallel to setValue.
function getValue(ptr, type, noSafe) {
    type = type || 'i8';
    if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
        case 'i1': return HEAP8[(ptr)];
        case 'i8': return HEAP8[(ptr)];
        case 'i16': return HEAP16[((ptr)>>1)];
        case 'i32': return HEAP32[((ptr)>>2)];
        case 'i64': return HEAP32[((ptr)>>2)];
        case 'float': return HEAPF32[((ptr)>>2)];
        case 'double': return HEAPF64[((ptr)>>3)];
        default: abort('invalid type for setValue: ' + type);
    }
    return null;
}
Module['getValue'] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module['ALLOC_NORMAL'] = ALLOC_NORMAL;
Module['ALLOC_STACK'] = ALLOC_STACK;
Module['ALLOC_STATIC'] = ALLOC_STATIC;
Module['ALLOC_DYNAMIC'] = ALLOC_DYNAMIC;
Module['ALLOC_NONE'] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
    var zeroinit, size;
    if (typeof slab === 'number') {
        zeroinit = true;
        size = slab;
    } else {
        zeroinit = false;
        size = slab.length;
    }

    var singleType = typeof types === 'string' ? types : null;

    var ret;
    if (allocator == ALLOC_NONE) {
        ret = ptr;
    } else {
        ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
    }

    if (zeroinit) {
        var ptr = ret, stop;
        assert((ret & 3) == 0);
        stop = ret + (size & ~3);
        for (; ptr < stop; ptr += 4) {
            HEAP32[((ptr)>>2)]=0;
        }
        stop = ret + size;
        while (ptr < stop) {
            HEAP8[((ptr++)|0)]=0;
        }
        return ret;
    }

    if (singleType === 'i8') {
        if (slab.subarray || slab.slice) {
            HEAPU8.set(slab, ret);
        } else {
            HEAPU8.set(new Uint8Array(slab), ret);
        }
        return ret;
    }

    var i = 0, type, typeSize, previousType;
    while (i < size) {
        var curr = slab[i];

        if (typeof curr === 'function') {
            curr = Runtime.getFunctionIndex(curr);
        }

        type = singleType || types[i];
        if (type === 0) {
            i++;
            continue;
        }

        if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

        setValue(ret+i, curr, type);

        // no need to look up size unless type changes, so cache it
        if (previousType !== type) {
            typeSize = Runtime.getNativeTypeSize(type);
            previousType = type;
        }
        i += typeSize;
    }

    return ret;
}
Module['allocate'] = allocate;

function Pointer_stringify(ptr, /* optional */ length) {
    // TODO: use TextDecoder
    // Find the length, and check for UTF while doing so
    var hasUtf = false;
    var t;
    var i = 0;
    while (1) {
        t = HEAPU8[(((ptr)+(i))|0)];
        if (t >= 128) hasUtf = true;
        else if (t == 0 && !length) break;
        i++;
        if (length && i == length) break;
    }
    if (!length) length = i;

    var ret = '';

    if (!hasUtf) {
        var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
        var curr;
        while (length > 0) {
            curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
            ret = ret ? ret + curr : curr;
            ptr += MAX_CHUNK;
            length -= MAX_CHUNK;
        }
        return ret;
    }

    var utf8 = new Runtime.UTF8Processor();
    for (i = 0; i < length; i++) {
        t = HEAPU8[(((ptr)+(i))|0)];
        ret += utf8.processCChar(t);
    }
    return ret;
}
Module['Pointer_stringify'] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.
function UTF16ToString(ptr) {
    var i = 0;

    var str = '';
    while (1) {
        var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
        if (codeUnit == 0)
            return str;
        ++i;
        // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
        str += String.fromCharCode(codeUnit);
    }
}
Module['UTF16ToString'] = UTF16ToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16LE form. The copy will require at most (str.length*2+1)*2 bytes of space in the HEAP.
function stringToUTF16(str, outPtr) {
    for(var i = 0; i < str.length; ++i) {
        // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
        var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
        HEAP16[(((outPtr)+(i*2))>>1)]=codeUnit;
    }
    // Null-terminate the pointer to the HEAP.
    HEAP16[(((outPtr)+(str.length*2))>>1)]=0;
}
Module['stringToUTF16'] = stringToUTF16;

// Given a pointer 'ptr' to a null-terminated UTF32LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.
function UTF32ToString(ptr) {
    var i = 0;

    var str = '';
    while (1) {
        var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
        if (utf32 == 0)
            return str;
        ++i;
        // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
        if (utf32 >= 0x10000) {
            var ch = utf32 - 0x10000;
            str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
        } else {
            str += String.fromCharCode(utf32);
        }
    }
}
Module['UTF32ToString'] = UTF32ToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32LE form. The copy will require at most (str.length+1)*4 bytes of space in the HEAP,
// but can use less, since str.length does not return the number of characters in the string, but the number of UTF-16 code units in the string.
function stringToUTF32(str, outPtr) {
    var iChar = 0;
    for(var iCodeUnit = 0; iCodeUnit < str.length; ++iCodeUnit) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
        var codeUnit = str.charCodeAt(iCodeUnit); // possibly a lead surrogate
        if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
            var trailSurrogate = str.charCodeAt(++iCodeUnit);
            codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
        }
        HEAP32[(((outPtr)+(iChar*4))>>2)]=codeUnit;
        ++iChar;
    }
    // Null-terminate the pointer to the HEAP.
    HEAP32[(((outPtr)+(iChar*4))>>2)]=0;
}
Module['stringToUTF32'] = stringToUTF32;

function demangle(func) {
    var i = 3;
    // params, etc.
    var basicTypes = {
        'v': 'void',
        'b': 'bool',
        'c': 'char',
        's': 'short',
        'i': 'int',
        'l': 'long',
        'f': 'float',
        'd': 'double',
        'w': 'wchar_t',
        'a': 'signed char',
        'h': 'unsigned char',
        't': 'unsigned short',
        'j': 'unsigned int',
        'm': 'unsigned long',
        'x': 'long long',
        'y': 'unsigned long long',
        'z': '...'
    };
    var subs = [];
    var first = true;
    function dump(x) {
        //return;
        if (x) Module.print(x);
        Module.print(func);
        var pre = '';
        for (var a = 0; a < i; a++) pre += ' ';
        Module.print (pre + '^');
    }
    function parseNested() {
        i++;
        if (func[i] === 'K') i++; // ignore const
        var parts = [];
        while (func[i] !== 'E') {
            if (func[i] === 'S') { // substitution
                i++;
                var next = func.indexOf('_', i);
                var num = func.substring(i, next) || 0;
                parts.push(subs[num] || '?');
                i = next+1;
                continue;
            }
            if (func[i] === 'C') { // constructor
                parts.push(parts[parts.length-1]);
                i += 2;
                continue;
            }
            var size = parseInt(func.substr(i));
            var pre = size.toString().length;
            if (!size || !pre) { i--; break; } // counter i++ below us
            var curr = func.substr(i + pre, size);
            parts.push(curr);
            subs.push(curr);
            i += pre + size;
        }
        i++; // skip E
        return parts;
    }
    function parse(rawList, limit, allowVoid) { // main parser
        limit = limit || Infinity;
        var ret = '', list = [];
        function flushList() {
            return '(' + list.join(', ') + ')';
        }
        var name;
        if (func[i] === 'N') {
            // namespaced N-E
            name = parseNested().join('::');
            limit--;
            if (limit === 0) return rawList ? [name] : name;
        } else {
            // not namespaced
            if (func[i] === 'K' || (first && func[i] === 'L')) i++; // ignore const and first 'L'
            var size = parseInt(func.substr(i));
            if (size) {
                var pre = size.toString().length;
                name = func.substr(i + pre, size);
                i += pre + size;
            }
        }
        first = false;
        if (func[i] === 'I') {
            i++;
            var iList = parse(true);
            var iRet = parse(true, 1, true);
            ret += iRet[0] + ' ' + name + '<' + iList.join(', ') + '>';
        } else {
            ret = name;
        }
        paramLoop: while (i < func.length && limit-- > 0) {
            //dump('paramLoop');
            var c = func[i++];
            if (c in basicTypes) {
                list.push(basicTypes[c]);
            } else {
                switch (c) {
                    case 'P': list.push(parse(true, 1, true)[0] + '*'); break; // pointer
                    case 'R': list.push(parse(true, 1, true)[0] + '&'); break; // reference
                    case 'L': { // literal
                        i++; // skip basic type
                        var end = func.indexOf('E', i);
                        var size = end - i;
                        list.push(func.substr(i, size));
                        i += size + 2; // size + 'EE'
                        break;
                    }
                    case 'A': { // array
                        var size = parseInt(func.substr(i));
                        i += size.toString().length;
                        if (func[i] !== '_') throw '?';
                        i++; // skip _
                        list.push(parse(true, 1, true)[0] + ' [' + size + ']');
                        break;
                    }
                    case 'E': break paramLoop;
                    default: ret += '?' + c; break paramLoop;
                }
            }
        }
        if (!allowVoid && list.length === 1 && list[0] === 'void') list = []; // avoid (void)
        return rawList ? list : ret + flushList();
    }
    try {
        // Special-case the entry point, since its name differs from other name mangling.
        if (func == 'Object._main' || func == '_main') {
            return 'main()';
        }
        if (typeof func === 'number') func = Pointer_stringify(func);
        if (func[0] !== '_') return func;
        if (func[1] !== '_') return func; // C function
        if (func[2] !== 'Z') return func;
        switch (func[3]) {
            case 'n': return 'operator new()';
            case 'd': return 'operator delete()';
        }
        return parse();
    } catch(e) {
        return func;
    }
}

function demangleAll(text) {
    return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}

function stackTrace() {
    var stack = new Error().stack;
    return stack ? demangleAll(stack) : '(no stack trace available)'; // Stack trace is not available at least on IE10 and Safari 6.
}

// Memory management

var PAGE_SIZE = 4096;
function alignMemoryPage(x) {
    return (x+4095)&-4096;
}

var HEAP;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk

function enlargeMemory() {
    abort('Cannot enlarge memory arrays. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with ALLOW_MEMORY_GROWTH which adjusts the size at runtime but prevents some optimizations, or (3) set Module.TOTAL_MEMORY before the program runs.');
}

var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
var FAST_MEMORY = Module['FAST_MEMORY'] || 2097152;

var totalMemory = 4096;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
    if (totalMemory < 16*1024*1024) {
        totalMemory *= 2;
    } else {
        totalMemory += 16*1024*1024
    }
}
if (totalMemory !== TOTAL_MEMORY) {
    Module.printErr('increasing TOTAL_MEMORY to ' + totalMemory + ' to be more reasonable');
    TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && !!(new Int32Array(1)['subarray']) && !!(new Int32Array(1)['set']),
    'JS engine does not provide full typed array support');

var buffer = new ArrayBuffer(TOTAL_MEMORY);
HEAP8 = new Int8Array(buffer);
HEAP16 = new Int16Array(buffer);
HEAP32 = new Int32Array(buffer);
HEAPU8 = new Uint8Array(buffer);
HEAPU16 = new Uint16Array(buffer);
HEAPU32 = new Uint32Array(buffer);
HEAPF32 = new Float32Array(buffer);
HEAPF64 = new Float64Array(buffer);

// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, 'Typed arrays 2 must be run on a little-endian system');

Module['HEAP'] = HEAP;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
    while(callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == 'function') {
            callback();
            continue;
        }
        var func = callback.func;
        if (typeof func === 'number') {
            if (callback.arg === undefined) {
                Runtime.dynCall('v', func);
            } else {
                Runtime.dynCall('vi', func, [callback.arg]);
            }
        } else {
            func(callback.arg === undefined ? null : callback.arg);
        }
    }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;

function preRun() {
    // compatibility - merge in anything from Module['preRun'] at this time
    if (Module['preRun']) {
        if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
        while (Module['preRun'].length) {
            addOnPreRun(Module['preRun'].shift());
        }
    }
    callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
    if (runtimeInitialized) return;
    runtimeInitialized = true;
    callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
    callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
    callRuntimeCallbacks(__ATEXIT__);
}

function postRun() {
    // compatibility - merge in anything from Module['postRun'] at this time
    if (Module['postRun']) {
        if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
        while (Module['postRun'].length) {
            addOnPostRun(Module['postRun'].shift());
        }
    }
    callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb);
}
Module['addOnPreRun'] = Module.addOnPreRun = addOnPreRun;

function addOnInit(cb) {
    __ATINIT__.unshift(cb);
}
Module['addOnInit'] = Module.addOnInit = addOnInit;

function addOnPreMain(cb) {
    __ATMAIN__.unshift(cb);
}
Module['addOnPreMain'] = Module.addOnPreMain = addOnPreMain;

function addOnExit(cb) {
    __ATEXIT__.unshift(cb);
}
Module['addOnExit'] = Module.addOnExit = addOnExit;

function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb);
}
Module['addOnPostRun'] = Module.addOnPostRun = addOnPostRun;

// Tools

// This processes a JS string into a C-line array of numbers, 0-terminated.
// For LLVM-originating strings, see parser.js:parseLLVMString function
function intArrayFromString(stringy, dontAddNull, length /* optional */) {
    var ret = (new Runtime.UTF8Processor()).processJSString(stringy);
    if (length) {
        ret.length = length;
    }
    if (!dontAddNull) {
        ret.push(0);
    }
    return ret;
}
Module['intArrayFromString'] = intArrayFromString;

function intArrayToString(array) {
    var ret = [];
    for (var i = 0; i < array.length; i++) {
        var chr = array[i];
        if (chr > 0xFF) {
            chr &= 0xFF;
        }
        ret.push(String.fromCharCode(chr));
    }
    return ret.join('');
}
Module['intArrayToString'] = intArrayToString;

// Write a Javascript array to somewhere in the heap
function writeStringToMemory(string, buffer, dontAddNull) {
    var array = intArrayFromString(string, dontAddNull);
    var i = 0;
    while (i < array.length) {
        var chr = array[i];
        HEAP8[(((buffer)+(i))|0)]=chr;
        i = i + 1;
    }
}
Module['writeStringToMemory'] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
    for (var i = 0; i < array.length; i++) {
        HEAP8[(((buffer)+(i))|0)]=array[i];
    }
}
Module['writeArrayToMemory'] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
    for (var i = 0; i < str.length; i++) {
        HEAP8[(((buffer)+(i))|0)]=str.charCodeAt(i);
    }
    if (!dontAddNull) HEAP8[(((buffer)+(str.length))|0)]=0;
}
Module['writeAsciiToMemory'] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
    if (value >= 0) {
        return value;
    }
    return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
        : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
    if (value <= 0) {
        return value;
    }
    var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
        : Math.pow(2, bits-1);
    if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
        // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
        // TODO: In i64 mode 1, resign the two parts separately and safely
        value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
    }
    return value;
}

// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
    var ah  = a >>> 16;
    var al = a & 0xffff;
    var bh  = b >>> 16;
    var bl = b & 0xffff;
    return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function addRunDependency(id) {
    runDependencies++;
    if (Module['monitorRunDependencies']) {
        Module['monitorRunDependencies'](runDependencies);
    }
}
Module['addRunDependency'] = addRunDependency;
function removeRunDependency(id) {
    runDependencies--;
    if (Module['monitorRunDependencies']) {
        Module['monitorRunDependencies'](runDependencies);
    }
    if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null;
        }
        if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback(); // can add another dependenciesFulfilled
        }
    }
}
Module['removeRunDependency'] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data


var memoryInitializer = null;

// === Body ===





STATIC_BASE = 8;

STATICTOP = STATIC_BASE + Runtime.alignMemory(16891);
/* global initializers */ __ATINIT__.push();


/* memory initializer */ allocate([0,0,0,0,0,0,0,0,198,165,151,244,165,244,50,198,248,132,235,151,132,151,111,248,238,153,199,176,153,176,94,238,246,141,247,140,141,140,122,246,255,13,229,23,13,23,232,255,214,189,183,220,189,220,10,214,222,177,167,200,177,200,22,222,145,84,57,252,84,252,109,145,96,80,192,240,80,240,144,96,2,3,4,5,3,5,7,2,206,169,135,224,169,224,46,206,86,125,172,135,125,135,209,86,231,25,213,43,25,43,204,231,181,98,113,166,98,166,19,181,77,230,154,49,230,49,124,77,236,154,195,181,154,181,89,236,143,69,5,207,69,207,64,143,31,157,62,188,157,188,163,31,137,64,9,192,64,192,73,137,250,135,239,146,135,146,104,250,239,21,197,63,21,63,208,239,178,235,127,38,235,38,148,178,142,201,7,64,201,64,206,142,251,11,237,29,11,29,230,251,65,236,130,47,236,47,110,65,179,103,125,169,103,169,26,179,95,253,190,28,253,28,67,95,69,234,138,37,234,37,96,69,35,191,70,218,191,218,249,35,83,247,166,2,247,2,81,83,228,150,211,161,150,161,69,228,155,91,45,237,91,237,118,155,117,194,234,93,194,93,40,117,225,28,217,36,28,36,197,225,61,174,122,233,174,233,212,61,76,106,152,190,106,190,242,76,108,90,216,238,90,238,130,108,126,65,252,195,65,195,189,126,245,2,241,6,2,6,243,245,131,79,29,209,79,209,82,131,104,92,208,228,92,228,140,104,81,244,162,7,244,7,86,81,209,52,185,92,52,92,141,209,249,8,233,24,8,24,225,249,226,147,223,174,147,174,76,226,171,115,77,149,115,149,62,171,98,83,196,245,83,245,151,98,42,63,84,65,63,65,107,42,8,12,16,20,12,20,28,8,149,82,49,246,82,246,99,149,70,101,140,175,101,175,233,70,157,94,33,226,94,226,127,157,48,40,96,120,40,120,72,48,55,161,110,248,161,248,207,55,10,15,20,17,15,17,27,10,47,181,94,196,181,196,235,47,14,9,28,27,9,27,21,14,36,54,72,90,54,90,126,36,27,155,54,182,155,182,173,27,223,61,165,71,61,71,152,223,205,38,129,106,38,106,167,205,78,105,156,187,105,187,245,78,127,205,254,76,205,76,51,127,234,159,207,186,159,186,80,234,18,27,36,45,27,45,63,18,29,158,58,185,158,185,164,29,88,116,176,156,116,156,196,88,52,46,104,114,46,114,70,52,54,45,108,119,45,119,65,54,220,178,163,205,178,205,17,220,180,238,115,41,238,41,157,180,91,251,182,22,251,22,77,91,164,246,83,1,246,1,165,164,118,77,236,215,77,215,161,118,183,97,117,163,97,163,20,183,125,206,250,73,206,73,52,125,82,123,164,141,123,141,223,82,221,62,161,66,62,66,159,221,94,113,188,147,113,147,205,94,19,151,38,162,151,162,177,19,166,245,87,4,245,4,162,166,185,104,105,184,104,184,1,185,0,0,0,0,0,0,0,0,193,44,153,116,44,116,181,193,64,96,128,160,96,160,224,64,227,31,221,33,31,33,194,227,121,200,242,67,200,67,58,121,182,237,119,44,237,44,154,182,212,190,179,217,190,217,13,212,141,70,1,202,70,202,71,141,103,217,206,112,217,112,23,103,114,75,228,221,75,221,175,114,148,222,51,121,222,121,237,148,152,212,43,103,212,103,255,152,176,232,123,35,232,35,147,176,133,74,17,222,74,222,91,133,187,107,109,189,107,189,6,187,197,42,145,126,42,126,187,197,79,229,158,52,229,52,123,79,237,22,193,58,22,58,215,237,134,197,23,84,197,84,210,134,154,215,47,98,215,98,248,154,102,85,204,255,85,255,153,102,17,148,34,167,148,167,182,17,138,207,15,74,207,74,192,138,233,16,201,48,16,48,217,233,4,6,8,10,6,10,14,4,254,129,231,152,129,152,102,254,160,240,91,11,240,11,171,160,120,68,240,204,68,204,180,120,37,186,74,213,186,213,240,37,75,227,150,62,227,62,117,75,162,243,95,14,243,14,172,162,93,254,186,25,254,25,68,93,128,192,27,91,192,91,219,128,5,138,10,133,138,133,128,5,63,173,126,236,173,236,211,63,33,188,66,223,188,223,254,33,112,72,224,216,72,216,168,112,241,4,249,12,4,12,253,241,99,223,198,122,223,122,25,99,119,193,238,88,193,88,47,119,175,117,69,159,117,159,48,175,66,99,132,165,99,165,231,66,32,48,64,80,48,80,112,32,229,26,209,46,26,46,203,229,253,14,225,18,14,18,239,253,191,109,101,183,109,183,8,191,129,76,25,212,76,212,85,129,24,20,48,60,20,60,36,24,38,53,76,95,53,95,121,38,195,47,157,113,47,113,178,195,190,225,103,56,225,56,134,190,53,162,106,253,162,253,200,53,136,204,11,79,204,79,199,136,46,57,92,75,57,75,101,46,147,87,61,249,87,249,106,147,85,242,170,13,242,13,88,85,252,130,227,157,130,157,97,252,122,71,244,201,71,201,179,122,200,172,139,239,172,239,39,200,186,231,111,50,231,50,136,186,50,43,100,125,43,125,79,50,230,149,215,164,149,164,66,230,192,160,155,251,160,251,59,192,25,152,50,179,152,179,170,25,158,209,39,104,209,104,246,158,163,127,93,129,127,129,34,163,68,102,136,170,102,170,238,68,84,126,168,130,126,130,214,84,59,171,118,230,171,230,221,59,11,131,22,158,131,158,149,11,140,202,3,69,202,69,201,140,199,41,149,123,41,123,188,199,107,211,214,110,211,110,5,107,40,60,80,68,60,68,108,40,167,121,85,139,121,139,44,167,188,226,99,61,226,61,129,188,22,29,44,39,29,39,49,22,173,118,65,154,118,154,55,173,219,59,173,77,59,77,150,219,100,86,200,250,86,250,158,100,116,78,232,210,78,210,166,116,20,30,40,34,30,34,54,20,146,219,63,118,219,118,228,146,12,10,24,30,10,30,18,12,72,108,144,180,108,180,252,72,184,228,107,55,228,55,143,184,159,93,37,231,93,231,120,159,189,110,97,178,110,178,15,189,67,239,134,42,239,42,105,67,196,166,147,241,166,241,53,196,57,168,114,227,168,227,218,57,49,164,98,247,164,247,198,49,211,55,189,89,55,89,138,211,242,139,255,134,139,134,116,242,213,50,177,86,50,86,131,213,139,67,13,197,67,197,78,139,110,89,220,235,89,235,133,110,218,183,175,194,183,194,24,218,1,140,2,143,140,143,142,1,177,100,121,172,100,172,29,177,156,210,35,109,210,109,241,156,73,224,146,59,224,59,114,73,216,180,171,199,180,199,31,216,172,250,67,21,250,21,185,172,243,7,253,9,7,9,250,243,207,37,133,111,37,111,160,207,202,175,143,234,175,234,32,202,244,142,243,137,142,137,125,244,71,233,142,32,233,32,103,71,16,24,32,40,24,40,56,16,111,213,222,100,213,100,11,111,240,136,251,131,136,131,115,240,74,111,148,177,111,177,251,74,92,114,184,150,114,150,202,92,56,36,112,108,36,108,84,56,87,241,174,8,241,8,95,87,115,199,230,82,199,82,33,115,151,81,53,243,81,243,100,151,203,35,141,101,35,101,174,203,161,124,89,132,124,132,37,161,232,156,203,191,156,191,87,232,62,33,124,99,33,99,93,62,150,221,55,124,221,124,234,150,97,220,194,127,220,127,30,97,13,134,26,145,134,145,156,13,15,133,30,148,133,148,155,15,224,144,219,171,144,171,75,224,124,66,248,198,66,198,186,124,113,196,226,87,196,87,38,113,204,170,131,229,170,229,41,204,144,216,59,115,216,115,227,144,6,5,12,15,5,15,9,6,247,1,245,3,1,3,244,247,28,18,56,54,18,54,42,28,194,163,159,254,163,254,60,194,106,95,212,225,95,225,139,106,174,249,71,16,249,16,190,174,105,208,210,107,208,107,2,105,23,145,46,168,145,168,191,23,153,88,41,232,88,232,113,153,58,39,116,105,39,105,83,58,39,185,78,208,185,208,247,39,217,56,169,72,56,72,145,217,235,19,205,53,19,53,222,235,43,179,86,206,179,206,229,43,34,51,68,85,51,85,119,34,210,187,191,214,187,214,4,210,169,112,73,144,112,144,57,169,7,137,14,128,137,128,135,7,51,167,102,242,167,242,193,51,45,182,90,193,182,193,236,45,60,34,120,102,34,102,90,60,21,146,42,173,146,173,184,21,201,32,137,96,32,96,169,201,135,73,21,219,73,219,92,135,170,255,79,26,255,26,176,170,80,120,160,136,120,136,216,80,165,122,81,142,122,142,43,165,3,143,6,138,143,138,137,3,89,248,178,19,248,19,74,89,9,128,18,155,128,155,146,9,26,23,52,57,23,57,35,26,101,218,202,117,218,117,16,101,215,49,181,83,49,83,132,215,132,198,19,81,198,81,213,132,208,184,187,211,184,211,3,208,130,195,31,94,195,94,220,130,41,176,82,203,176,203,226,41,90,119,180,153,119,153,195,90,30,17,60,51,17,51,45,30,123,203,246,70,203,70,61,123,168,252,75,31,252,31,183,168,109,214,218,97,214,97,12,109,44,58,88,78,58,78,98,44,165,151,244,165,244,50,198,198,132,235,151,132,151,111,248,248,153,199,176,153,176,94,238,238,141,247,140,141,140,122,246,246,13,229,23,13,23,232,255,255,189,183,220,189,220,10,214,214,177,167,200,177,200,22,222,222,84,57,252,84,252,109,145,145,80,192,240,80,240,144,96,96,3,4,5,3,5,7,2,2,169,135,224,169,224,46,206,206,125,172,135,125,135,209,86,86,25,213,43,25,43,204,231,231,98,113,166,98,166,19,181,181,230,154,49,230,49,124,77,77,154,195,181,154,181,89,236,236,69,5,207,69,207,64,143,143,157,62,188,157,188,163,31,31,64,9,192,64,192,73,137,137,135,239,146,135,146,104,250,250,21,197,63,21,63,208,239,239,235,127,38,235,38,148,178,178,201,7,64,201,64,206,142,142,11,237,29,11,29,230,251,251,236,130,47,236,47,110,65,65,103,125,169,103,169,26,179,179,253,190,28,253,28,67,95,95,234,138,37,234,37,96,69,69,191,70,218,191,218,249,35,35,247,166,2,247,2,81,83,83,150,211,161,150,161,69,228,228,91,45,237,91,237,118,155,155,194,234,93,194,93,40,117,117,28,217,36,28,36,197,225,225,174,122,233,174,233,212,61,61,106,152,190,106,190,242,76,76,90,216,238,90,238,130,108,108,65,252,195,65,195,189,126,126,2,241,6,2,6,243,245,245,79,29,209,79,209,82,131,131,92,208,228,92,228,140,104,104,244,162,7,244,7,86,81,81,52,185,92,52,92,141,209,209,8,233,24,8,24,225,249,249,147,223,174,147,174,76,226,226,115,77,149,115,149,62,171,171,83,196,245,83,245,151,98,98,63,84,65,63,65,107,42,42,12,16,20,12,20,28,8,8,82,49,246,82,246,99,149,149,101,140,175,101,175,233,70,70,94,33,226,94,226,127,157,157,40,96,120,40,120,72,48,48,161,110,248,161,248,207,55,55,15,20,17,15,17,27,10,10,181,94,196,181,196,235,47,47,9,28,27,9,27,21,14,14,54,72,90,54,90,126,36,36,155,54,182,155,182,173,27,27,61,165,71,61,71,152,223,223,38,129,106,38,106,167,205,205,105,156,187,105,187,245,78,78,205,254,76,205,76,51,127,127,159,207,186,159,186,80,234,234,27,36,45,27,45,63,18,18,158,58,185,158,185,164,29,29,116,176,156,116,156,196,88,88,46,104,114,46,114,70,52,52,45,108,119,45,119,65,54,54,178,163,205,178,205,17,220,220,238,115,41,238,41,157,180,180,251,182,22,251,22,77,91,91,246,83,1,246,1,165,164,164,77,236,215,77,215,161,118,118,97,117,163,97,163,20,183,183,206,250,73,206,73,52,125,125,123,164,141,123,141,223,82,82,62,161,66,62,66,159,221,221,113,188,147,113,147,205,94,94,151,38,162,151,162,177,19,19,245,87,4,245,4,162,166,166,104,105,184,104,184,1,185,185,0,0,0,0,0,0,0,0,44,153,116,44,116,181,193,193,96,128,160,96,160,224,64,64,31,221,33,31,33,194,227,227,200,242,67,200,67,58,121,121,237,119,44,237,44,154,182,182,190,179,217,190,217,13,212,212,70,1,202,70,202,71,141,141,217,206,112,217,112,23,103,103,75,228,221,75,221,175,114,114,222,51,121,222,121,237,148,148,212,43,103,212,103,255,152,152,232,123,35,232,35,147,176,176,74,17,222,74,222,91,133,133,107,109,189,107,189,6,187,187,42,145,126,42,126,187,197,197,229,158,52,229,52,123,79,79,22,193,58,22,58,215,237,237,197,23,84,197,84,210,134,134,215,47,98,215,98,248,154,154,85,204,255,85,255,153,102,102,148,34,167,148,167,182,17,17,207,15,74,207,74,192,138,138,16,201,48,16,48,217,233,233,6,8,10,6,10,14,4,4,129,231,152,129,152,102,254,254,240,91,11,240,11,171,160,160,68,240,204,68,204,180,120,120,186,74,213,186,213,240,37,37,227,150,62,227,62,117,75,75,243,95,14,243,14,172,162,162,254,186,25,254,25,68,93,93,192,27,91,192,91,219,128,128,138,10,133,138,133,128,5,5,173,126,236,173,236,211,63,63,188,66,223,188,223,254,33,33,72,224,216,72,216,168,112,112,4,249,12,4,12,253,241,241,223,198,122,223,122,25,99,99,193,238,88,193,88,47,119,119,117,69,159,117,159,48,175,175,99,132,165,99,165,231,66,66,48,64,80,48,80,112,32,32,26,209,46,26,46,203,229,229,14,225,18,14,18,239,253,253,109,101,183,109,183,8,191,191,76,25,212,76,212,85,129,129,20,48,60,20,60,36,24,24,53,76,95,53,95,121,38,38,47,157,113,47,113,178,195,195,225,103,56,225,56,134,190,190,162,106,253,162,253,200,53,53,204,11,79,204,79,199,136,136,57,92,75,57,75,101,46,46,87,61,249,87,249,106,147,147,242,170,13,242,13,88,85,85,130,227,157,130,157,97,252,252,71,244,201,71,201,179,122,122,172,139,239,172,239,39,200,200,231,111,50,231,50,136,186,186,43,100,125,43,125,79,50,50,149,215,164,149,164,66,230,230,160,155,251,160,251,59,192,192,152,50,179,152,179,170,25,25,209,39,104,209,104,246,158,158,127,93,129,127,129,34,163,163,102,136,170,102,170,238,68,68,126,168,130,126,130,214,84,84,171,118,230,171,230,221,59,59,131,22,158,131,158,149,11,11,202,3,69,202,69,201,140,140,41,149,123,41,123,188,199,199,211,214,110,211,110,5,107,107,60,80,68,60,68,108,40,40,121,85,139,121,139,44,167,167,226,99,61,226,61,129,188,188,29,44,39,29,39,49,22,22,118,65,154,118,154,55,173,173,59,173,77,59,77,150,219,219,86,200,250,86,250,158,100,100,78,232,210,78,210,166,116,116,30,40,34,30,34,54,20,20,219,63,118,219,118,228,146,146,10,24,30,10,30,18,12,12,108,144,180,108,180,252,72,72,228,107,55,228,55,143,184,184,93,37,231,93,231,120,159,159,110,97,178,110,178,15,189,189,239,134,42,239,42,105,67,67,166,147,241,166,241,53,196,196,168,114,227,168,227,218,57,57,164,98,247,164,247,198,49,49,55,189,89,55,89,138,211,211,139,255,134,139,134,116,242,242,50,177,86,50,86,131,213,213,67,13,197,67,197,78,139,139,89,220,235,89,235,133,110,110,183,175,194,183,194,24,218,218,140,2,143,140,143,142,1,1,100,121,172,100,172,29,177,177,210,35,109,210,109,241,156,156,224,146,59,224,59,114,73,73,180,171,199,180,199,31,216,216,250,67,21,250,21,185,172,172,7,253,9,7,9,250,243,243,37,133,111,37,111,160,207,207,175,143,234,175,234,32,202,202,142,243,137,142,137,125,244,244,233,142,32,233,32,103,71,71,24,32,40,24,40,56,16,16,213,222,100,213,100,11,111,111,136,251,131,136,131,115,240,240,111,148,177,111,177,251,74,74,114,184,150,114,150,202,92,92,36,112,108,36,108,84,56,56,241,174,8,241,8,95,87,87,199,230,82,199,82,33,115,115,81,53,243,81,243,100,151,151,35,141,101,35,101,174,203,203,124,89,132,124,132,37,161,161,156,203,191,156,191,87,232,232,33,124,99,33,99,93,62,62,221,55,124,221,124,234,150,150,220,194,127,220,127,30,97,97,134,26,145,134,145,156,13,13,133,30,148,133,148,155,15,15,144,219,171,144,171,75,224,224,66,248,198,66,198,186,124,124,196,226,87,196,87,38,113,113,170,131,229,170,229,41,204,204,216,59,115,216,115,227,144,144,5,12,15,5,15,9,6,6,1,245,3,1,3,244,247,247,18,56,54,18,54,42,28,28,163,159,254,163,254,60,194,194,95,212,225,95,225,139,106,106,249,71,16,249,16,190,174,174,208,210,107,208,107,2,105,105,145,46,168,145,168,191,23,23,88,41,232,88,232,113,153,153,39,116,105,39,105,83,58,58,185,78,208,185,208,247,39,39,56,169,72,56,72,145,217,217,19,205,53,19,53,222,235,235,179,86,206,179,206,229,43,43,51,68,85,51,85,119,34,34,187,191,214,187,214,4,210,210,112,73,144,112,144,57,169,169,137,14,128,137,128,135,7,7,167,102,242,167,242,193,51,51,182,90,193,182,193,236,45,45,34,120,102,34,102,90,60,60,146,42,173,146,173,184,21,21,32,137,96,32,96,169,201,201,73,21,219,73,219,92,135,135,255,79,26,255,26,176,170,170,120,160,136,120,136,216,80,80,122,81,142,122,142,43,165,165,143,6,138,143,138,137,3,3,248,178,19,248,19,74,89,89,128,18,155,128,155,146,9,9,23,52,57,23,57,35,26,26,218,202,117,218,117,16,101,101,49,181,83,49,83,132,215,215,198,19,81,198,81,213,132,132,184,187,211,184,211,3,208,208,195,31,94,195,94,220,130,130,176,82,203,176,203,226,41,41,119,180,153,119,153,195,90,90,17,60,51,17,51,45,30,30,203,246,70,203,70,61,123,123,252,75,31,252,31,183,168,168,214,218,97,214,97,12,109,109,58,88,78,58,78,98,44,44,151,244,165,244,50,198,198,165,235,151,132,151,111,248,248,132,199,176,153,176,94,238,238,153,247,140,141,140,122,246,246,141,229,23,13,23,232,255,255,13,183,220,189,220,10,214,214,189,167,200,177,200,22,222,222,177,57,252,84,252,109,145,145,84,192,240,80,240,144,96,96,80,4,5,3,5,7,2,2,3,135,224,169,224,46,206,206,169,172,135,125,135,209,86,86,125,213,43,25,43,204,231,231,25,113,166,98,166,19,181,181,98,154,49,230,49,124,77,77,230,195,181,154,181,89,236,236,154,5,207,69,207,64,143,143,69,62,188,157,188,163,31,31,157,9,192,64,192,73,137,137,64,239,146,135,146,104,250,250,135,197,63,21,63,208,239,239,21,127,38,235,38,148,178,178,235,7,64,201,64,206,142,142,201,237,29,11,29,230,251,251,11,130,47,236,47,110,65,65,236,125,169,103,169,26,179,179,103,190,28,253,28,67,95,95,253,138,37,234,37,96,69,69,234,70,218,191,218,249,35,35,191,166,2,247,2,81,83,83,247,211,161,150,161,69,228,228,150,45,237,91,237,118,155,155,91,234,93,194,93,40,117,117,194,217,36,28,36,197,225,225,28,122,233,174,233,212,61,61,174,152,190,106,190,242,76,76,106,216,238,90,238,130,108,108,90,252,195,65,195,189,126,126,65,241,6,2,6,243,245,245,2,29,209,79,209,82,131,131,79,208,228,92,228,140,104,104,92,162,7,244,7,86,81,81,244,185,92,52,92,141,209,209,52,233,24,8,24,225,249,249,8,223,174,147,174,76,226,226,147,77,149,115,149,62,171,171,115,196,245,83,245,151,98,98,83,84,65,63,65,107,42,42,63,16,20,12,20,28,8,8,12,49,246,82,246,99,149,149,82,140,175,101,175,233,70,70,101,33,226,94,226,127,157,157,94,96,120,40,120,72,48,48,40,110,248,161,248,207,55,55,161,20,17,15,17,27,10,10,15,94,196,181,196,235,47,47,181,28,27,9,27,21,14,14,9,72,90,54,90,126,36,36,54,54,182,155,182,173,27,27,155,165,71,61,71,152,223,223,61,129,106,38,106,167,205,205,38,156,187,105,187,245,78,78,105,254,76,205,76,51,127,127,205,207,186,159,186,80,234,234,159,36,45,27,45,63,18,18,27,58,185,158,185,164,29,29,158,176,156,116,156,196,88,88,116,104,114,46,114,70,52,52,46,108,119,45,119,65,54,54,45,163,205,178,205,17,220,220,178,115,41,238,41,157,180,180,238,182,22,251,22,77,91,91,251,83,1,246,1,165,164,164,246,236,215,77,215,161,118,118,77,117,163,97,163,20,183,183,97,250,73,206,73,52,125,125,206,164,141,123,141,223,82,82,123,161,66,62,66,159,221,221,62,188,147,113,147,205,94,94,113,38,162,151,162,177,19,19,151,87,4,245,4,162,166,166,245,105,184,104,184,1,185,185,104,0,0,0,0,0,0,0,0,153,116,44,116,181,193,193,44,128,160,96,160,224,64,64,96,221,33,31,33,194,227,227,31,242,67,200,67,58,121,121,200,119,44,237,44,154,182,182,237,179,217,190,217,13,212,212,190,1,202,70,202,71,141,141,70,206,112,217,112,23,103,103,217,228,221,75,221,175,114,114,75,51,121,222,121,237,148,148,222,43,103,212,103,255,152,152,212,123,35,232,35,147,176,176,232,17,222,74,222,91,133,133,74,109,189,107,189,6,187,187,107,145,126,42,126,187,197,197,42,158,52,229,52,123,79,79,229,193,58,22,58,215,237,237,22,23,84,197,84,210,134,134,197,47,98,215,98,248,154,154,215,204,255,85,255,153,102,102,85,34,167,148,167,182,17,17,148,15,74,207,74,192,138,138,207,201,48,16,48,217,233,233,16,8,10,6,10,14,4,4,6,231,152,129,152,102,254,254,129,91,11,240,11,171,160,160,240,240,204,68,204,180,120,120,68,74,213,186,213,240,37,37,186,150,62,227,62,117,75,75,227,95,14,243,14,172,162,162,243,186,25,254,25,68,93,93,254,27,91,192,91,219,128,128,192,10,133,138,133,128,5,5,138,126,236,173,236,211,63,63,173,66,223,188,223,254,33,33,188,224,216,72,216,168,112,112,72,249,12,4,12,253,241,241,4,198,122,223,122,25,99,99,223,238,88,193,88,47,119,119,193,69,159,117,159,48,175,175,117,132,165,99,165,231,66,66,99,64,80,48,80,112,32,32,48,209,46,26,46,203,229,229,26,225,18,14,18,239,253,253,14,101,183,109,183,8,191,191,109,25,212,76,212,85,129,129,76,48,60,20,60,36,24,24,20,76,95,53,95,121,38,38,53,157,113,47,113,178,195,195,47,103,56,225,56,134,190,190,225,106,253,162,253,200,53,53,162,11,79,204,79,199,136,136,204,92,75,57,75,101,46,46,57,61,249,87,249,106,147,147,87,170,13,242,13,88,85,85,242,227,157,130,157,97,252,252,130,244,201,71,201,179,122,122,71,139,239,172,239,39,200,200,172,111,50,231,50,136,186,186,231,100,125,43,125,79,50,50,43,215,164,149,164,66,230,230,149,155,251,160,251,59,192,192,160,50,179,152,179,170,25,25,152,39,104,209,104,246,158,158,209,93,129,127,129,34,163,163,127,136,170,102,170,238,68,68,102,168,130,126,130,214,84,84,126,118,230,171,230,221,59,59,171,22,158,131,158,149,11,11,131,3,69,202,69,201,140,140,202,149,123,41,123,188,199,199,41,214,110,211,110,5,107,107,211,80,68,60,68,108,40,40,60,85,139,121,139,44,167,167,121,99,61,226,61,129,188,188,226,44,39,29,39,49,22,22,29,65,154,118,154,55,173,173,118,173,77,59,77,150,219,219,59,200,250,86,250,158,100,100,86,232,210,78,210,166,116,116,78,40,34,30,34,54,20,20,30,63,118,219,118,228,146,146,219,24,30,10,30,18,12,12,10,144,180,108,180,252,72,72,108,107,55,228,55,143,184,184,228,37,231,93,231,120,159,159,93,97,178,110,178,15,189,189,110,134,42,239,42,105,67,67,239,147,241,166,241,53,196,196,166,114,227,168,227,218,57,57,168,98,247,164,247,198,49,49,164,189,89,55,89,138,211,211,55,255,134,139,134,116,242,242,139,177,86,50,86,131,213,213,50,13,197,67,197,78,139,139,67,220,235,89,235,133,110,110,89,175,194,183,194,24,218,218,183,2,143,140,143,142,1,1,140,121,172,100,172,29,177,177,100,35,109,210,109,241,156,156,210,146,59,224,59,114,73,73,224,171,199,180,199,31,216,216,180,67,21,250,21,185,172,172,250,253,9,7,9,250,243,243,7,133,111,37,111,160,207,207,37,143,234,175,234,32,202,202,175,243,137,142,137,125,244,244,142,142,32,233,32,103,71,71,233,32,40,24,40,56,16,16,24,222,100,213,100,11,111,111,213,251,131,136,131,115,240,240,136,148,177,111,177,251,74,74,111,184,150,114,150,202,92,92,114,112,108,36,108,84,56,56,36,174,8,241,8,95,87,87,241,230,82,199,82,33,115,115,199,53,243,81,243,100,151,151,81,141,101,35,101,174,203,203,35,89,132,124,132,37,161,161,124,203,191,156,191,87,232,232,156,124,99,33,99,93,62,62,33,55,124,221,124,234,150,150,221,194,127,220,127,30,97,97,220,26,145,134,145,156,13,13,134,30,148,133,148,155,15,15,133,219,171,144,171,75,224,224,144,248,198,66,198,186,124,124,66,226,87,196,87,38,113,113,196,131,229,170,229,41,204,204,170,59,115,216,115,227,144,144,216,12,15,5,15,9,6,6,5,245,3,1,3,244,247,247,1,56,54,18,54,42,28,28,18,159,254,163,254,60,194,194,163,212,225,95,225,139,106,106,95,71,16,249,16,190,174,174,249,210,107,208,107,2,105,105,208,46,168,145,168,191,23,23,145,41,232,88,232,113,153,153,88,116,105,39,105,83,58,58,39,78,208,185,208,247,39,39,185,169,72,56,72,145,217,217,56,205,53,19,53,222,235,235,19,86,206,179,206,229,43,43,179,68,85,51,85,119,34,34,51,191,214,187,214,4,210,210,187,73,144,112,144,57,169,169,112,14,128,137,128,135,7,7,137,102,242,167,242,193,51,51,167,90,193,182,193,236,45,45,182,120,102,34,102,90,60,60,34,42,173,146,173,184,21,21,146,137,96,32,96,169,201,201,32,21,219,73,219,92,135,135,73,79,26,255,26,176,170,170,255,160,136,120,136,216,80,80,120,81,142,122,142,43,165,165,122,6,138,143,138,137,3,3,143,178,19,248,19,74,89,89,248,18,155,128,155,146,9,9,128,52,57,23,57,35,26,26,23,202,117,218,117,16,101,101,218,181,83,49,83,132,215,215,49,19,81,198,81,213,132,132,198,187,211,184,211,3,208,208,184,31,94,195,94,220,130,130,195,82,203,176,203,226,41,41,176,180,153,119,153,195,90,90,119,60,51,17,51,45,30,30,17,246,70,203,70,61,123,123,203,75,31,252,31,183,168,168,252,218,97,214,97,12,109,109,214,88,78,58,78,98,44,44,58,244,165,244,50,198,198,165,151,151,132,151,111,248,248,132,235,176,153,176,94,238,238,153,199,140,141,140,122,246,246,141,247,23,13,23,232,255,255,13,229,220,189,220,10,214,214,189,183,200,177,200,22,222,222,177,167,252,84,252,109,145,145,84,57,240,80,240,144,96,96,80,192,5,3,5,7,2,2,3,4,224,169,224,46,206,206,169,135,135,125,135,209,86,86,125,172,43,25,43,204,231,231,25,213,166,98,166,19,181,181,98,113,49,230,49,124,77,77,230,154,181,154,181,89,236,236,154,195,207,69,207,64,143,143,69,5,188,157,188,163,31,31,157,62,192,64,192,73,137,137,64,9,146,135,146,104,250,250,135,239,63,21,63,208,239,239,21,197,38,235,38,148,178,178,235,127,64,201,64,206,142,142,201,7,29,11,29,230,251,251,11,237,47,236,47,110,65,65,236,130,169,103,169,26,179,179,103,125,28,253,28,67,95,95,253,190,37,234,37,96,69,69,234,138,218,191,218,249,35,35,191,70,2,247,2,81,83,83,247,166,161,150,161,69,228,228,150,211,237,91,237,118,155,155,91,45,93,194,93,40,117,117,194,234,36,28,36,197,225,225,28,217,233,174,233,212,61,61,174,122,190,106,190,242,76,76,106,152,238,90,238,130,108,108,90,216,195,65,195,189,126,126,65,252,6,2,6,243,245,245,2,241,209,79,209,82,131,131,79,29,228,92,228,140,104,104,92,208,7,244,7,86,81,81,244,162,92,52,92,141,209,209,52,185,24,8,24,225,249,249,8,233,174,147,174,76,226,226,147,223,149,115,149,62,171,171,115,77,245,83,245,151,98,98,83,196,65,63,65,107,42,42,63,84,20,12,20,28,8,8,12,16,246,82,246,99,149,149,82,49,175,101,175,233,70,70,101,140,226,94,226,127,157,157,94,33,120,40,120,72,48,48,40,96,248,161,248,207,55,55,161,110,17,15,17,27,10,10,15,20,196,181,196,235,47,47,181,94,27,9,27,21,14,14,9,28,90,54,90,126,36,36,54,72,182,155,182,173,27,27,155,54,71,61,71,152,223,223,61,165,106,38,106,167,205,205,38,129,187,105,187,245,78,78,105,156,76,205,76,51,127,127,205,254,186,159,186,80,234,234,159,207,45,27,45,63,18,18,27,36,185,158,185,164,29,29,158,58,156,116,156,196,88,88,116,176,114,46,114,70,52,52,46,104,119,45,119,65,54,54,45,108,205,178,205,17,220,220,178,163,41,238,41,157,180,180,238,115,22,251,22,77,91,91,251,182,1,246,1,165,164,164,246,83,215,77,215,161,118,118,77,236,163,97,163,20,183,183,97,117,73,206,73,52,125,125,206,250,141,123,141,223,82,82,123,164,66,62,66,159,221,221,62,161,147,113,147,205,94,94,113,188,162,151,162,177,19,19,151,38,4,245,4,162,166,166,245,87,184,104,184,1,185,185,104,105,0,0,0,0,0,0,0,0,116,44,116,181,193,193,44,153,160,96,160,224,64,64,96,128,33,31,33,194,227,227,31,221,67,200,67,58,121,121,200,242,44,237,44,154,182,182,237,119,217,190,217,13,212,212,190,179,202,70,202,71,141,141,70,1,112,217,112,23,103,103,217,206,221,75,221,175,114,114,75,228,121,222,121,237,148,148,222,51,103,212,103,255,152,152,212,43,35,232,35,147,176,176,232,123,222,74,222,91,133,133,74,17,189,107,189,6,187,187,107,109,126,42,126,187,197,197,42,145,52,229,52,123,79,79,229,158,58,22,58,215,237,237,22,193,84,197,84,210,134,134,197,23,98,215,98,248,154,154,215,47,255,85,255,153,102,102,85,204,167,148,167,182,17,17,148,34,74,207,74,192,138,138,207,15,48,16,48,217,233,233,16,201,10,6,10,14,4,4,6,8,152,129,152,102,254,254,129,231,11,240,11,171,160,160,240,91,204,68,204,180,120,120,68,240,213,186,213,240,37,37,186,74,62,227,62,117,75,75,227,150,14,243,14,172,162,162,243,95,25,254,25,68,93,93,254,186,91,192,91,219,128,128,192,27,133,138,133,128,5,5,138,10,236,173,236,211,63,63,173,126,223,188,223,254,33,33,188,66,216,72,216,168,112,112,72,224,12,4,12,253,241,241,4,249,122,223,122,25,99,99,223,198,88,193,88,47,119,119,193,238,159,117,159,48,175,175,117,69,165,99,165,231,66,66,99,132,80,48,80,112,32,32,48,64,46,26,46,203,229,229,26,209,18,14,18,239,253,253,14,225,183,109,183,8,191,191,109,101,212,76,212,85,129,129,76,25,60,20,60,36,24,24,20,48,95,53,95,121,38,38,53,76,113,47,113,178,195,195,47,157,56,225,56,134,190,190,225,103,253,162,253,200,53,53,162,106,79,204,79,199,136,136,204,11,75,57,75,101,46,46,57,92,249,87,249,106,147,147,87,61,13,242,13,88,85,85,242,170,157,130,157,97,252,252,130,227,201,71,201,179,122,122,71,244,239,172,239,39,200,200,172,139,50,231,50,136,186,186,231,111,125,43,125,79,50,50,43,100,164,149,164,66,230,230,149,215,251,160,251,59,192,192,160,155,179,152,179,170,25,25,152,50,104,209,104,246,158,158,209,39,129,127,129,34,163,163,127,93,170,102,170,238,68,68,102,136,130,126,130,214,84,84,126,168,230,171,230,221,59,59,171,118,158,131,158,149,11,11,131,22,69,202,69,201,140,140,202,3,123,41,123,188,199,199,41,149,110,211,110,5,107,107,211,214,68,60,68,108,40,40,60,80,139,121,139,44,167,167,121,85,61,226,61,129,188,188,226,99,39,29,39,49,22,22,29,44,154,118,154,55,173,173,118,65,77,59,77,150,219,219,59,173,250,86,250,158,100,100,86,200,210,78,210,166,116,116,78,232,34,30,34,54,20,20,30,40,118,219,118,228,146,146,219,63,30,10,30,18,12,12,10,24,180,108,180,252,72,72,108,144,55,228,55,143,184,184,228,107,231,93,231,120,159,159,93,37,178,110,178,15,189,189,110,97,42,239,42,105,67,67,239,134,241,166,241,53,196,196,166,147,227,168,227,218,57,57,168,114,247,164,247,198,49,49,164,98,89,55,89,138,211,211,55,189,134,139,134,116,242,242,139,255,86,50,86,131,213,213,50,177,197,67,197,78,139,139,67,13,235,89,235,133,110,110,89,220,194,183,194,24,218,218,183,175,143,140,143,142,1,1,140,2,172,100,172,29,177,177,100,121,109,210,109,241,156,156,210,35,59,224,59,114,73,73,224,146,199,180,199,31,216,216,180,171,21,250,21,185,172,172,250,67,9,7,9,250,243,243,7,253,111,37,111,160,207,207,37,133,234,175,234,32,202,202,175,143,137,142,137,125,244,244,142,243,32,233,32,103,71,71,233,142,40,24,40,56,16,16,24,32,100,213,100,11,111,111,213,222,131,136,131,115,240,240,136,251,177,111,177,251,74,74,111,148,150,114,150,202,92,92,114,184,108,36,108,84,56,56,36,112,8,241,8,95,87,87,241,174,82,199,82,33,115,115,199,230,243,81,243,100,151,151,81,53,101,35,101,174,203,203,35,141,132,124,132,37,161,161,124,89,191,156,191,87,232,232,156,203,99,33,99,93,62,62,33,124,124,221,124,234,150,150,221,55,127,220,127,30,97,97,220,194,145,134,145,156,13,13,134,26,148,133,148,155,15,15,133,30,171,144,171,75,224,224,144,219,198,66,198,186,124,124,66,248,87,196,87,38,113,113,196,226,229,170,229,41,204,204,170,131,115,216,115,227,144,144,216,59,15,5,15,9,6,6,5,12,3,1,3,244,247,247,1,245,54,18,54,42,28,28,18,56,254,163,254,60,194,194,163,159,225,95,225,139,106,106,95,212,16,249,16,190,174,174,249,71,107,208,107,2,105,105,208,210,168,145,168,191,23,23,145,46,232,88,232,113,153,153,88,41,105,39,105,83,58,58,39,116,208,185,208,247,39,39,185,78,72,56,72,145,217,217,56,169,53,19,53,222,235,235,19,205,206,179,206,229,43,43,179,86,85,51,85,119,34,34,51,68,214,187,214,4,210,210,187,191,144,112,144,57,169,169,112,73,128,137,128,135,7,7,137,14,242,167,242,193,51,51,167,102,193,182,193,236,45,45,182,90,102,34,102,90,60,60,34,120,173,146,173,184,21,21,146,42,96,32,96,169,201,201,32,137,219,73,219,92,135,135,73,21,26,255,26,176,170,170,255,79,136,120,136,216,80,80,120,160,142,122,142,43,165,165,122,81,138,143,138,137,3,3,143,6,19,248,19,74,89,89,248,178,155,128,155,146,9,9,128,18,57,23,57,35,26,26,23,52,117,218,117,16,101,101,218,202,83,49,83,132,215,215,49,181,81,198,81,213,132,132,198,19,211,184,211,3,208,208,184,187,94,195,94,220,130,130,195,31,203,176,203,226,41,41,176,82,153,119,153,195,90,90,119,180,51,17,51,45,30,30,17,60,70,203,70,61,123,123,203,246,31,252,31,183,168,168,252,75,97,214,97,12,109,109,214,218,78,58,78,98,44,44,58,88,165,244,50,198,198,165,151,244,132,151,111,248,248,132,235,151,153,176,94,238,238,153,199,176,141,140,122,246,246,141,247,140,13,23,232,255,255,13,229,23,189,220,10,214,214,189,183,220,177,200,22,222,222,177,167,200,84,252,109,145,145,84,57,252,80,240,144,96,96,80,192,240,3,5,7,2,2,3,4,5,169,224,46,206,206,169,135,224,125,135,209,86,86,125,172,135,25,43,204,231,231,25,213,43,98,166,19,181,181,98,113,166,230,49,124,77,77,230,154,49,154,181,89,236,236,154,195,181,69,207,64,143,143,69,5,207,157,188,163,31,31,157,62,188,64,192,73,137,137,64,9,192,135,146,104,250,250,135,239,146,21,63,208,239,239,21,197,63,235,38,148,178,178,235,127,38,201,64,206,142,142,201,7,64,11,29,230,251,251,11,237,29,236,47,110,65,65,236,130,47,103,169,26,179,179,103,125,169,253,28,67,95,95,253,190,28,234,37,96,69,69,234,138,37,191,218,249,35,35,191,70,218,247,2,81,83,83,247,166,2,150,161,69,228,228,150,211,161,91,237,118,155,155,91,45,237,194,93,40,117,117,194,234,93,28,36,197,225,225,28,217,36,174,233,212,61,61,174,122,233,106,190,242,76,76,106,152,190,90,238,130,108,108,90,216,238,65,195,189,126,126,65,252,195,2,6,243,245,245,2,241,6,79,209,82,131,131,79,29,209,92,228,140,104,104,92,208,228,244,7,86,81,81,244,162,7,52,92,141,209,209,52,185,92,8,24,225,249,249,8,233,24,147,174,76,226,226,147,223,174,115,149,62,171,171,115,77,149,83,245,151,98,98,83,196,245,63,65,107,42,42,63,84,65,12,20,28,8,8,12,16,20,82,246,99,149,149,82,49,246,101,175,233,70,70,101,140,175,94,226,127,157,157,94,33,226,40,120,72,48,48,40,96,120,161,248,207,55,55,161,110,248,15,17,27,10,10,15,20,17,181,196,235,47,47,181,94,196,9,27,21,14,14,9,28,27,54,90,126,36,36,54,72,90,155,182,173,27,27,155,54,182,61,71,152,223,223,61,165,71,38,106,167,205,205,38,129,106,105,187,245,78,78,105,156,187,205,76,51,127,127,205,254,76,159,186,80,234,234,159,207,186,27,45,63,18,18,27,36,45,158,185,164,29,29,158,58,185,116,156,196,88,88,116,176,156,46,114,70,52,52,46,104,114,45,119,65,54,54,45,108,119,178,205,17,220,220,178,163,205,238,41,157,180,180,238,115,41,251,22,77,91,91,251,182,22,246,1,165,164,164,246,83,1,77,215,161,118,118,77,236,215,97,163,20,183,183,97,117,163,206,73,52,125,125,206,250,73,123,141,223,82,82,123,164,141,62,66,159,221,221,62,161,66,113,147,205,94,94,113,188,147,151,162,177,19,19,151,38,162,245,4,162,166,166,245,87,4,104,184,1,185,185,104,105,184,0,0,0,0,0,0,0,0,44,116,181,193,193,44,153,116,96,160,224,64,64,96,128,160,31,33,194,227,227,31,221,33,200,67,58,121,121,200,242,67,237,44,154,182,182,237,119,44,190,217,13,212,212,190,179,217,70,202,71,141,141,70,1,202,217,112,23,103,103,217,206,112,75,221,175,114,114,75,228,221,222,121,237,148,148,222,51,121,212,103,255,152,152,212,43,103,232,35,147,176,176,232,123,35,74,222,91,133,133,74,17,222,107,189,6,187,187,107,109,189,42,126,187,197,197,42,145,126,229,52,123,79,79,229,158,52,22,58,215,237,237,22,193,58,197,84,210,134,134,197,23,84,215,98,248,154,154,215,47,98,85,255,153,102,102,85,204,255,148,167,182,17,17,148,34,167,207,74,192,138,138,207,15,74,16,48,217,233,233,16,201,48,6,10,14,4,4,6,8,10,129,152,102,254,254,129,231,152,240,11,171,160,160,240,91,11,68,204,180,120,120,68,240,204,186,213,240,37,37,186,74,213,227,62,117,75,75,227,150,62,243,14,172,162,162,243,95,14,254,25,68,93,93,254,186,25,192,91,219,128,128,192,27,91,138,133,128,5,5,138,10,133,173,236,211,63,63,173,126,236,188,223,254,33,33,188,66,223,72,216,168,112,112,72,224,216,4,12,253,241,241,4,249,12,223,122,25,99,99,223,198,122,193,88,47,119,119,193,238,88,117,159,48,175,175,117,69,159,99,165,231,66,66,99,132,165,48,80,112,32,32,48,64,80,26,46,203,229,229,26,209,46,14,18,239,253,253,14,225,18,109,183,8,191,191,109,101,183,76,212,85,129,129,76,25,212,20,60,36,24,24,20,48,60,53,95,121,38,38,53,76,95,47,113,178,195,195,47,157,113,225,56,134,190,190,225,103,56,162,253,200,53,53,162,106,253,204,79,199,136,136,204,11,79,57,75,101,46,46,57,92,75,87,249,106,147,147,87,61,249,242,13,88,85,85,242,170,13,130,157,97,252,252,130,227,157,71,201,179,122,122,71,244,201,172,239,39,200,200,172,139,239,231,50,136,186,186,231,111,50,43,125,79,50,50,43,100,125,149,164,66,230,230,149,215,164,160,251,59,192,192,160,155,251,152,179,170,25,25,152,50,179,209,104,246,158,158,209,39,104,127,129,34,163,163,127,93,129,102,170,238,68,68,102,136,170,126,130,214,84,84,126,168,130,171,230,221,59,59,171,118,230,131,158,149,11,11,131,22,158,202,69,201,140,140,202,3,69,41,123,188,199,199,41,149,123,211,110,5,107,107,211,214,110,60,68,108,40,40,60,80,68,121,139,44,167,167,121,85,139,226,61,129,188,188,226,99,61,29,39,49,22,22,29,44,39,118,154,55,173,173,118,65,154,59,77,150,219,219,59,173,77,86,250,158,100,100,86,200,250,78,210,166,116,116,78,232,210,30,34,54,20,20,30,40,34,219,118,228,146,146,219,63,118,10,30,18,12,12,10,24,30,108,180,252,72,72,108,144,180,228,55,143,184,184,228,107,55,93,231,120,159,159,93,37,231,110,178,15,189,189,110,97,178,239,42,105,67,67,239,134,42,166,241,53,196,196,166,147,241,168,227,218,57,57,168,114,227,164,247,198,49,49,164,98,247,55,89,138,211,211,55,189,89,139,134,116,242,242,139,255,134,50,86,131,213,213,50,177,86,67,197,78,139,139,67,13,197,89,235,133,110,110,89,220,235,183,194,24,218,218,183,175,194,140,143,142,1,1,140,2,143,100,172,29,177,177,100,121,172,210,109,241,156,156,210,35,109,224,59,114,73,73,224,146,59,180,199,31,216,216,180,171,199,250,21,185,172,172,250,67,21,7,9,250,243,243,7,253,9,37,111,160,207,207,37,133,111,175,234,32,202,202,175,143,234,142,137,125,244,244,142,243,137,233,32,103,71,71,233,142,32,24,40,56,16,16,24,32,40,213,100,11,111,111,213,222,100,136,131,115,240,240,136,251,131,111,177,251,74,74,111,148,177,114,150,202,92,92,114,184,150,36,108,84,56,56,36,112,108,241,8,95,87,87,241,174,8,199,82,33,115,115,199,230,82,81,243,100,151,151,81,53,243,35,101,174,203,203,35,141,101,124,132,37,161,161,124,89,132,156,191,87,232,232,156,203,191,33,99,93,62,62,33,124,99,221,124,234,150,150,221,55,124,220,127,30,97,97,220,194,127,134,145,156,13,13,134,26,145,133,148,155,15,15,133,30,148,144,171,75,224,224,144,219,171,66,198,186,124,124,66,248,198,196,87,38,113,113,196,226,87,170,229,41,204,204,170,131,229,216,115,227,144,144,216,59,115,5,15,9,6,6,5,12,15,1,3,244,247,247,1,245,3,18,54,42,28,28,18,56,54,163,254,60,194,194,163,159,254,95,225,139,106,106,95,212,225,249,16,190,174,174,249,71,16,208,107,2,105,105,208,210,107,145,168,191,23,23,145,46,168,88,232,113,153,153,88,41,232,39,105,83,58,58,39,116,105,185,208,247,39,39,185,78,208,56,72,145,217,217,56,169,72,19,53,222,235,235,19,205,53,179,206,229,43,43,179,86,206,51,85,119,34,34,51,68,85,187,214,4,210,210,187,191,214,112,144,57,169,169,112,73,144,137,128,135,7,7,137,14,128,167,242,193,51,51,167,102,242,182,193,236,45,45,182,90,193,34,102,90,60,60,34,120,102,146,173,184,21,21,146,42,173,32,96,169,201,201,32,137,96,73,219,92,135,135,73,21,219,255,26,176,170,170,255,79,26,120,136,216,80,80,120,160,136,122,142,43,165,165,122,81,142,143,138,137,3,3,143,6,138,248,19,74,89,89,248,178,19,128,155,146,9,9,128,18,155,23,57,35,26,26,23,52,57,218,117,16,101,101,218,202,117,49,83,132,215,215,49,181,83,198,81,213,132,132,198,19,81,184,211,3,208,208,184,187,211,195,94,220,130,130,195,31,94,176,203,226,41,41,176,82,203,119,153,195,90,90,119,180,153,17,51,45,30,30,17,60,51,203,70,61,123,123,203,246,70,252,31,183,168,168,252,75,31,214,97,12,109,109,214,218,97], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);
/* memory initializer */ allocate([58,78,98,44,44,58,88,78,244,50,198,198,165,151,244,165,151,111,248,248,132,235,151,132,176,94,238,238,153,199,176,153,140,122,246,246,141,247,140,141,23,232,255,255,13,229,23,13,220,10,214,214,189,183,220,189,200,22,222,222,177,167,200,177,252,109,145,145,84,57,252,84,240,144,96,96,80,192,240,80,5,7,2,2,3,4,5,3,224,46,206,206,169,135,224,169,135,209,86,86,125,172,135,125,43,204,231,231,25,213,43,25,166,19,181,181,98,113,166,98,49,124,77,77,230,154,49,230,181,89,236,236,154,195,181,154,207,64,143,143,69,5,207,69,188,163,31,31,157,62,188,157,192,73,137,137,64,9,192,64,146,104,250,250,135,239,146,135,63,208,239,239,21,197,63,21,38,148,178,178,235,127,38,235,64,206,142,142,201,7,64,201,29,230,251,251,11,237,29,11,47,110,65,65,236,130,47,236,169,26,179,179,103,125,169,103,28,67,95,95,253,190,28,253,37,96,69,69,234,138,37,234,218,249,35,35,191,70,218,191,2,81,83,83,247,166,2,247,161,69,228,228,150,211,161,150,237,118,155,155,91,45,237,91,93,40,117,117,194,234,93,194,36,197,225,225,28,217,36,28,233,212,61,61,174,122,233,174,190,242,76,76,106,152,190,106,238,130,108,108,90,216,238,90,195,189,126,126,65,252,195,65,6,243,245,245,2,241,6,2,209,82,131,131,79,29,209,79,228,140,104,104,92,208,228,92,7,86,81,81,244,162,7,244,92,141,209,209,52,185,92,52,24,225,249,249,8,233,24,8,174,76,226,226,147,223,174,147,149,62,171,171,115,77,149,115,245,151,98,98,83,196,245,83,65,107,42,42,63,84,65,63,20,28,8,8,12,16,20,12,246,99,149,149,82,49,246,82,175,233,70,70,101,140,175,101,226,127,157,157,94,33,226,94,120,72,48,48,40,96,120,40,248,207,55,55,161,110,248,161,17,27,10,10,15,20,17,15,196,235,47,47,181,94,196,181,27,21,14,14,9,28,27,9,90,126,36,36,54,72,90,54,182,173,27,27,155,54,182,155,71,152,223,223,61,165,71,61,106,167,205,205,38,129,106,38,187,245,78,78,105,156,187,105,76,51,127,127,205,254,76,205,186,80,234,234,159,207,186,159,45,63,18,18,27,36,45,27,185,164,29,29,158,58,185,158,156,196,88,88,116,176,156,116,114,70,52,52,46,104,114,46,119,65,54,54,45,108,119,45,205,17,220,220,178,163,205,178,41,157,180,180,238,115,41,238,22,77,91,91,251,182,22,251,1,165,164,164,246,83,1,246,215,161,118,118,77,236,215,77,163,20,183,183,97,117,163,97,73,52,125,125,206,250,73,206,141,223,82,82,123,164,141,123,66,159,221,221,62,161,66,62,147,205,94,94,113,188,147,113,162,177,19,19,151,38,162,151,4,162,166,166,245,87,4,245,184,1,185,185,104,105,184,104,0,0,0,0,0,0,0,0,116,181,193,193,44,153,116,44,160,224,64,64,96,128,160,96,33,194,227,227,31,221,33,31,67,58,121,121,200,242,67,200,44,154,182,182,237,119,44,237,217,13,212,212,190,179,217,190,202,71,141,141,70,1,202,70,112,23,103,103,217,206,112,217,221,175,114,114,75,228,221,75,121,237,148,148,222,51,121,222,103,255,152,152,212,43,103,212,35,147,176,176,232,123,35,232,222,91,133,133,74,17,222,74,189,6,187,187,107,109,189,107,126,187,197,197,42,145,126,42,52,123,79,79,229,158,52,229,58,215,237,237,22,193,58,22,84,210,134,134,197,23,84,197,98,248,154,154,215,47,98,215,255,153,102,102,85,204,255,85,167,182,17,17,148,34,167,148,74,192,138,138,207,15,74,207,48,217,233,233,16,201,48,16,10,14,4,4,6,8,10,6,152,102,254,254,129,231,152,129,11,171,160,160,240,91,11,240,204,180,120,120,68,240,204,68,213,240,37,37,186,74,213,186,62,117,75,75,227,150,62,227,14,172,162,162,243,95,14,243,25,68,93,93,254,186,25,254,91,219,128,128,192,27,91,192,133,128,5,5,138,10,133,138,236,211,63,63,173,126,236,173,223,254,33,33,188,66,223,188,216,168,112,112,72,224,216,72,12,253,241,241,4,249,12,4,122,25,99,99,223,198,122,223,88,47,119,119,193,238,88,193,159,48,175,175,117,69,159,117,165,231,66,66,99,132,165,99,80,112,32,32,48,64,80,48,46,203,229,229,26,209,46,26,18,239,253,253,14,225,18,14,183,8,191,191,109,101,183,109,212,85,129,129,76,25,212,76,60,36,24,24,20,48,60,20,95,121,38,38,53,76,95,53,113,178,195,195,47,157,113,47,56,134,190,190,225,103,56,225,253,200,53,53,162,106,253,162,79,199,136,136,204,11,79,204,75,101,46,46,57,92,75,57,249,106,147,147,87,61,249,87,13,88,85,85,242,170,13,242,157,97,252,252,130,227,157,130,201,179,122,122,71,244,201,71,239,39,200,200,172,139,239,172,50,136,186,186,231,111,50,231,125,79,50,50,43,100,125,43,164,66,230,230,149,215,164,149,251,59,192,192,160,155,251,160,179,170,25,25,152,50,179,152,104,246,158,158,209,39,104,209,129,34,163,163,127,93,129,127,170,238,68,68,102,136,170,102,130,214,84,84,126,168,130,126,230,221,59,59,171,118,230,171,158,149,11,11,131,22,158,131,69,201,140,140,202,3,69,202,123,188,199,199,41,149,123,41,110,5,107,107,211,214,110,211,68,108,40,40,60,80,68,60,139,44,167,167,121,85,139,121,61,129,188,188,226,99,61,226,39,49,22,22,29,44,39,29,154,55,173,173,118,65,154,118,77,150,219,219,59,173,77,59,250,158,100,100,86,200,250,86,210,166,116,116,78,232,210,78,34,54,20,20,30,40,34,30,118,228,146,146,219,63,118,219,30,18,12,12,10,24,30,10,180,252,72,72,108,144,180,108,55,143,184,184,228,107,55,228,231,120,159,159,93,37,231,93,178,15,189,189,110,97,178,110,42,105,67,67,239,134,42,239,241,53,196,196,166,147,241,166,227,218,57,57,168,114,227,168,247,198,49,49,164,98,247,164,89,138,211,211,55,189,89,55,134,116,242,242,139,255,134,139,86,131,213,213,50,177,86,50,197,78,139,139,67,13,197,67,235,133,110,110,89,220,235,89,194,24,218,218,183,175,194,183,143,142,1,1,140,2,143,140,172,29,177,177,100,121,172,100,109,241,156,156,210,35,109,210,59,114,73,73,224,146,59,224,199,31,216,216,180,171,199,180,21,185,172,172,250,67,21,250,9,250,243,243,7,253,9,7,111,160,207,207,37,133,111,37,234,32,202,202,175,143,234,175,137,125,244,244,142,243,137,142,32,103,71,71,233,142,32,233,40,56,16,16,24,32,40,24,100,11,111,111,213,222,100,213,131,115,240,240,136,251,131,136,177,251,74,74,111,148,177,111,150,202,92,92,114,184,150,114,108,84,56,56,36,112,108,36,8,95,87,87,241,174,8,241,82,33,115,115,199,230,82,199,243,100,151,151,81,53,243,81,101,174,203,203,35,141,101,35,132,37,161,161,124,89,132,124,191,87,232,232,156,203,191,156,99,93,62,62,33,124,99,33,124,234,150,150,221,55,124,221,127,30,97,97,220,194,127,220,145,156,13,13,134,26,145,134,148,155,15,15,133,30,148,133,171,75,224,224,144,219,171,144,198,186,124,124,66,248,198,66,87,38,113,113,196,226,87,196,229,41,204,204,170,131,229,170,115,227,144,144,216,59,115,216,15,9,6,6,5,12,15,5,3,244,247,247,1,245,3,1,54,42,28,28,18,56,54,18,254,60,194,194,163,159,254,163,225,139,106,106,95,212,225,95,16,190,174,174,249,71,16,249,107,2,105,105,208,210,107,208,168,191,23,23,145,46,168,145,232,113,153,153,88,41,232,88,105,83,58,58,39,116,105,39,208,247,39,39,185,78,208,185,72,145,217,217,56,169,72,56,53,222,235,235,19,205,53,19,206,229,43,43,179,86,206,179,85,119,34,34,51,68,85,51,214,4,210,210,187,191,214,187,144,57,169,169,112,73,144,112,128,135,7,7,137,14,128,137,242,193,51,51,167,102,242,167,193,236,45,45,182,90,193,182,102,90,60,60,34,120,102,34,173,184,21,21,146,42,173,146,96,169,201,201,32,137,96,32,219,92,135,135,73,21,219,73,26,176,170,170,255,79,26,255,136,216,80,80,120,160,136,120,142,43,165,165,122,81,142,122,138,137,3,3,143,6,138,143,19,74,89,89,248,178,19,248,155,146,9,9,128,18,155,128,57,35,26,26,23,52,57,23,117,16,101,101,218,202,117,218,83,132,215,215,49,181,83,49,81,213,132,132,198,19,81,198,211,3,208,208,184,187,211,184,94,220,130,130,195,31,94,195,203,226,41,41,176,82,203,176,153,195,90,90,119,180,153,119,51,45,30,30,17,60,51,17,70,61,123,123,203,246,70,203,31,183,168,168,252,75,31,252,97,12,109,109,214,218,97,214,78,98,44,44,58,88,78,58,50,198,198,165,151,244,165,244,111,248,248,132,235,151,132,151,94,238,238,153,199,176,153,176,122,246,246,141,247,140,141,140,232,255,255,13,229,23,13,23,10,214,214,189,183,220,189,220,22,222,222,177,167,200,177,200,109,145,145,84,57,252,84,252,144,96,96,80,192,240,80,240,7,2,2,3,4,5,3,5,46,206,206,169,135,224,169,224,209,86,86,125,172,135,125,135,204,231,231,25,213,43,25,43,19,181,181,98,113,166,98,166,124,77,77,230,154,49,230,49,89,236,236,154,195,181,154,181,64,143,143,69,5,207,69,207,163,31,31,157,62,188,157,188,73,137,137,64,9,192,64,192,104,250,250,135,239,146,135,146,208,239,239,21,197,63,21,63,148,178,178,235,127,38,235,38,206,142,142,201,7,64,201,64,230,251,251,11,237,29,11,29,110,65,65,236,130,47,236,47,26,179,179,103,125,169,103,169,67,95,95,253,190,28,253,28,96,69,69,234,138,37,234,37,249,35,35,191,70,218,191,218,81,83,83,247,166,2,247,2,69,228,228,150,211,161,150,161,118,155,155,91,45,237,91,237,40,117,117,194,234,93,194,93,197,225,225,28,217,36,28,36,212,61,61,174,122,233,174,233,242,76,76,106,152,190,106,190,130,108,108,90,216,238,90,238,189,126,126,65,252,195,65,195,243,245,245,2,241,6,2,6,82,131,131,79,29,209,79,209,140,104,104,92,208,228,92,228,86,81,81,244,162,7,244,7,141,209,209,52,185,92,52,92,225,249,249,8,233,24,8,24,76,226,226,147,223,174,147,174,62,171,171,115,77,149,115,149,151,98,98,83,196,245,83,245,107,42,42,63,84,65,63,65,28,8,8,12,16,20,12,20,99,149,149,82,49,246,82,246,233,70,70,101,140,175,101,175,127,157,157,94,33,226,94,226,72,48,48,40,96,120,40,120,207,55,55,161,110,248,161,248,27,10,10,15,20,17,15,17,235,47,47,181,94,196,181,196,21,14,14,9,28,27,9,27,126,36,36,54,72,90,54,90,173,27,27,155,54,182,155,182,152,223,223,61,165,71,61,71,167,205,205,38,129,106,38,106,245,78,78,105,156,187,105,187,51,127,127,205,254,76,205,76,80,234,234,159,207,186,159,186,63,18,18,27,36,45,27,45,164,29,29,158,58,185,158,185,196,88,88,116,176,156,116,156,70,52,52,46,104,114,46,114,65,54,54,45,108,119,45,119,17,220,220,178,163,205,178,205,157,180,180,238,115,41,238,41,77,91,91,251,182,22,251,22,165,164,164,246,83,1,246,1,161,118,118,77,236,215,77,215,20,183,183,97,117,163,97,163,52,125,125,206,250,73,206,73,223,82,82,123,164,141,123,141,159,221,221,62,161,66,62,66,205,94,94,113,188,147,113,147,177,19,19,151,38,162,151,162,162,166,166,245,87,4,245,4,1,185,185,104,105,184,104,184,0,0,0,0,0,0,0,0,181,193,193,44,153,116,44,116,224,64,64,96,128,160,96,160,194,227,227,31,221,33,31,33,58,121,121,200,242,67,200,67,154,182,182,237,119,44,237,44,13,212,212,190,179,217,190,217,71,141,141,70,1,202,70,202,23,103,103,217,206,112,217,112,175,114,114,75,228,221,75,221,237,148,148,222,51,121,222,121,255,152,152,212,43,103,212,103,147,176,176,232,123,35,232,35,91,133,133,74,17,222,74,222,6,187,187,107,109,189,107,189,187,197,197,42,145,126,42,126,123,79,79,229,158,52,229,52,215,237,237,22,193,58,22,58,210,134,134,197,23,84,197,84,248,154,154,215,47,98,215,98,153,102,102,85,204,255,85,255,182,17,17,148,34,167,148,167,192,138,138,207,15,74,207,74,217,233,233,16,201,48,16,48,14,4,4,6,8,10,6,10,102,254,254,129,231,152,129,152,171,160,160,240,91,11,240,11,180,120,120,68,240,204,68,204,240,37,37,186,74,213,186,213,117,75,75,227,150,62,227,62,172,162,162,243,95,14,243,14,68,93,93,254,186,25,254,25,219,128,128,192,27,91,192,91,128,5,5,138,10,133,138,133,211,63,63,173,126,236,173,236,254,33,33,188,66,223,188,223,168,112,112,72,224,216,72,216,253,241,241,4,249,12,4,12,25,99,99,223,198,122,223,122,47,119,119,193,238,88,193,88,48,175,175,117,69,159,117,159,231,66,66,99,132,165,99,165,112,32,32,48,64,80,48,80,203,229,229,26,209,46,26,46,239,253,253,14,225,18,14,18,8,191,191,109,101,183,109,183,85,129,129,76,25,212,76,212,36,24,24,20,48,60,20,60,121,38,38,53,76,95,53,95,178,195,195,47,157,113,47,113,134,190,190,225,103,56,225,56,200,53,53,162,106,253,162,253,199,136,136,204,11,79,204,79,101,46,46,57,92,75,57,75,106,147,147,87,61,249,87,249,88,85,85,242,170,13,242,13,97,252,252,130,227,157,130,157,179,122,122,71,244,201,71,201,39,200,200,172,139,239,172,239,136,186,186,231,111,50,231,50,79,50,50,43,100,125,43,125,66,230,230,149,215,164,149,164,59,192,192,160,155,251,160,251,170,25,25,152,50,179,152,179,246,158,158,209,39,104,209,104,34,163,163,127,93,129,127,129,238,68,68,102,136,170,102,170,214,84,84,126,168,130,126,130,221,59,59,171,118,230,171,230,149,11,11,131,22,158,131,158,201,140,140,202,3,69,202,69,188,199,199,41,149,123,41,123,5,107,107,211,214,110,211,110,108,40,40,60,80,68,60,68,44,167,167,121,85,139,121,139,129,188,188,226,99,61,226,61,49,22,22,29,44,39,29,39,55,173,173,118,65,154,118,154,150,219,219,59,173,77,59,77,158,100,100,86,200,250,86,250,166,116,116,78,232,210,78,210,54,20,20,30,40,34,30,34,228,146,146,219,63,118,219,118,18,12,12,10,24,30,10,30,252,72,72,108,144,180,108,180,143,184,184,228,107,55,228,55,120,159,159,93,37,231,93,231,15,189,189,110,97,178,110,178,105,67,67,239,134,42,239,42,53,196,196,166,147,241,166,241,218,57,57,168,114,227,168,227,198,49,49,164,98,247,164,247,138,211,211,55,189,89,55,89,116,242,242,139,255,134,139,134,131,213,213,50,177,86,50,86,78,139,139,67,13,197,67,197,133,110,110,89,220,235,89,235,24,218,218,183,175,194,183,194,142,1,1,140,2,143,140,143,29,177,177,100,121,172,100,172,241,156,156,210,35,109,210,109,114,73,73,224,146,59,224,59,31,216,216,180,171,199,180,199,185,172,172,250,67,21,250,21,250,243,243,7,253,9,7,9,160,207,207,37,133,111,37,111,32,202,202,175,143,234,175,234,125,244,244,142,243,137,142,137,103,71,71,233,142,32,233,32,56,16,16,24,32,40,24,40,11,111,111,213,222,100,213,100,115,240,240,136,251,131,136,131,251,74,74,111,148,177,111,177,202,92,92,114,184,150,114,150,84,56,56,36,112,108,36,108,95,87,87,241,174,8,241,8,33,115,115,199,230,82,199,82,100,151,151,81,53,243,81,243,174,203,203,35,141,101,35,101,37,161,161,124,89,132,124,132,87,232,232,156,203,191,156,191,93,62,62,33,124,99,33,99,234,150,150,221,55,124,221,124,30,97,97,220,194,127,220,127,156,13,13,134,26,145,134,145,155,15,15,133,30,148,133,148,75,224,224,144,219,171,144,171,186,124,124,66,248,198,66,198,38,113,113,196,226,87,196,87,41,204,204,170,131,229,170,229,227,144,144,216,59,115,216,115,9,6,6,5,12,15,5,15,244,247,247,1,245,3,1,3,42,28,28,18,56,54,18,54,60,194,194,163,159,254,163,254,139,106,106,95,212,225,95,225,190,174,174,249,71,16,249,16,2,105,105,208,210,107,208,107,191,23,23,145,46,168,145,168,113,153,153,88,41,232,88,232,83,58,58,39,116,105,39,105,247,39,39,185,78,208,185,208,145,217,217,56,169,72,56,72,222,235,235,19,205,53,19,53,229,43,43,179,86,206,179,206,119,34,34,51,68,85,51,85,4,210,210,187,191,214,187,214,57,169,169,112,73,144,112,144,135,7,7,137,14,128,137,128,193,51,51,167,102,242,167,242,236,45,45,182,90,193,182,193,90,60,60,34,120,102,34,102,184,21,21,146,42,173,146,173,169,201,201,32,137,96,32,96,92,135,135,73,21,219,73,219,176,170,170,255,79,26,255,26,216,80,80,120,160,136,120,136,43,165,165,122,81,142,122,142,137,3,3,143,6,138,143,138,74,89,89,248,178,19,248,19,146,9,9,128,18,155,128,155,35,26,26,23,52,57,23,57,16,101,101,218,202,117,218,117,132,215,215,49,181,83,49,83,213,132,132,198,19,81,198,81,3,208,208,184,187,211,184,211,220,130,130,195,31,94,195,94,226,41,41,176,82,203,176,203,195,90,90,119,180,153,119,153,45,30,30,17,60,51,17,51,61,123,123,203,246,70,203,70,183,168,168,252,75,31,252,31,12,109,109,214,218,97,214,97,98,44,44,58,88,78,58,78,198,198,165,151,244,165,244,50,248,248,132,235,151,132,151,111,238,238,153,199,176,153,176,94,246,246,141,247,140,141,140,122,255,255,13,229,23,13,23,232,214,214,189,183,220,189,220,10,222,222,177,167,200,177,200,22,145,145,84,57,252,84,252,109,96,96,80,192,240,80,240,144,2,2,3,4,5,3,5,7,206,206,169,135,224,169,224,46,86,86,125,172,135,125,135,209,231,231,25,213,43,25,43,204,181,181,98,113,166,98,166,19,77,77,230,154,49,230,49,124,236,236,154,195,181,154,181,89,143,143,69,5,207,69,207,64,31,31,157,62,188,157,188,163,137,137,64,9,192,64,192,73,250,250,135,239,146,135,146,104,239,239,21,197,63,21,63,208,178,178,235,127,38,235,38,148,142,142,201,7,64,201,64,206,251,251,11,237,29,11,29,230,65,65,236,130,47,236,47,110,179,179,103,125,169,103,169,26,95,95,253,190,28,253,28,67,69,69,234,138,37,234,37,96,35,35,191,70,218,191,218,249,83,83,247,166,2,247,2,81,228,228,150,211,161,150,161,69,155,155,91,45,237,91,237,118,117,117,194,234,93,194,93,40,225,225,28,217,36,28,36,197,61,61,174,122,233,174,233,212,76,76,106,152,190,106,190,242,108,108,90,216,238,90,238,130,126,126,65,252,195,65,195,189,245,245,2,241,6,2,6,243,131,131,79,29,209,79,209,82,104,104,92,208,228,92,228,140,81,81,244,162,7,244,7,86,209,209,52,185,92,52,92,141,249,249,8,233,24,8,24,225,226,226,147,223,174,147,174,76,171,171,115,77,149,115,149,62,98,98,83,196,245,83,245,151,42,42,63,84,65,63,65,107,8,8,12,16,20,12,20,28,149,149,82,49,246,82,246,99,70,70,101,140,175,101,175,233,157,157,94,33,226,94,226,127,48,48,40,96,120,40,120,72,55,55,161,110,248,161,248,207,10,10,15,20,17,15,17,27,47,47,181,94,196,181,196,235,14,14,9,28,27,9,27,21,36,36,54,72,90,54,90,126,27,27,155,54,182,155,182,173,223,223,61,165,71,61,71,152,205,205,38,129,106,38,106,167,78,78,105,156,187,105,187,245,127,127,205,254,76,205,76,51,234,234,159,207,186,159,186,80,18,18,27,36,45,27,45,63,29,29,158,58,185,158,185,164,88,88,116,176,156,116,156,196,52,52,46,104,114,46,114,70,54,54,45,108,119,45,119,65,220,220,178,163,205,178,205,17,180,180,238,115,41,238,41,157,91,91,251,182,22,251,22,77,164,164,246,83,1,246,1,165,118,118,77,236,215,77,215,161,183,183,97,117,163,97,163,20,125,125,206,250,73,206,73,52,82,82,123,164,141,123,141,223,221,221,62,161,66,62,66,159,94,94,113,188,147,113,147,205,19,19,151,38,162,151,162,177,166,166,245,87,4,245,4,162,185,185,104,105,184,104,184,1,0,0,0,0,0,0,0,0,193,193,44,153,116,44,116,181,64,64,96,128,160,96,160,224,227,227,31,221,33,31,33,194,121,121,200,242,67,200,67,58,182,182,237,119,44,237,44,154,212,212,190,179,217,190,217,13,141,141,70,1,202,70,202,71,103,103,217,206,112,217,112,23,114,114,75,228,221,75,221,175,148,148,222,51,121,222,121,237,152,152,212,43,103,212,103,255,176,176,232,123,35,232,35,147,133,133,74,17,222,74,222,91,187,187,107,109,189,107,189,6,197,197,42,145,126,42,126,187,79,79,229,158,52,229,52,123,237,237,22,193,58,22,58,215,134,134,197,23,84,197,84,210,154,154,215,47,98,215,98,248,102,102,85,204,255,85,255,153,17,17,148,34,167,148,167,182,138,138,207,15,74,207,74,192,233,233,16,201,48,16,48,217,4,4,6,8,10,6,10,14,254,254,129,231,152,129,152,102,160,160,240,91,11,240,11,171,120,120,68,240,204,68,204,180,37,37,186,74,213,186,213,240,75,75,227,150,62,227,62,117,162,162,243,95,14,243,14,172,93,93,254,186,25,254,25,68,128,128,192,27,91,192,91,219,5,5,138,10,133,138,133,128,63,63,173,126,236,173,236,211,33,33,188,66,223,188,223,254,112,112,72,224,216,72,216,168,241,241,4,249,12,4,12,253,99,99,223,198,122,223,122,25,119,119,193,238,88,193,88,47,175,175,117,69,159,117,159,48,66,66,99,132,165,99,165,231,32,32,48,64,80,48,80,112,229,229,26,209,46,26,46,203,253,253,14,225,18,14,18,239,191,191,109,101,183,109,183,8,129,129,76,25,212,76,212,85,24,24,20,48,60,20,60,36,38,38,53,76,95,53,95,121,195,195,47,157,113,47,113,178,190,190,225,103,56,225,56,134,53,53,162,106,253,162,253,200,136,136,204,11,79,204,79,199,46,46,57,92,75,57,75,101,147,147,87,61,249,87,249,106,85,85,242,170,13,242,13,88,252,252,130,227,157,130,157,97,122,122,71,244,201,71,201,179,200,200,172,139,239,172,239,39,186,186,231,111,50,231,50,136,50,50,43,100,125,43,125,79,230,230,149,215,164,149,164,66,192,192,160,155,251,160,251,59,25,25,152,50,179,152,179,170,158,158,209,39,104,209,104,246,163,163,127,93,129,127,129,34,68,68,102,136,170,102,170,238,84,84,126,168,130,126,130,214,59,59,171,118,230,171,230,221,11,11,131,22,158,131,158,149,140,140,202,3,69,202,69,201,199,199,41,149,123,41,123,188,107,107,211,214,110,211,110,5,40,40,60,80,68,60,68,108,167,167,121,85,139,121,139,44,188,188,226,99,61,226,61,129,22,22,29,44,39,29,39,49,173,173,118,65,154,118,154,55,219,219,59,173,77,59,77,150,100,100,86,200,250,86,250,158,116,116,78,232,210,78,210,166,20,20,30,40,34,30,34,54,146,146,219,63,118,219,118,228,12,12,10,24,30,10,30,18,72,72,108,144,180,108,180,252,184,184,228,107,55,228,55,143,159,159,93,37,231,93,231,120,189,189,110,97,178,110,178,15,67,67,239,134,42,239,42,105,196,196,166,147,241,166,241,53,57,57,168,114,227,168,227,218,49,49,164,98,247,164,247,198,211,211,55,189,89,55,89,138,242,242,139,255,134,139,134,116,213,213,50,177,86,50,86,131,139,139,67,13,197,67,197,78,110,110,89,220,235,89,235,133,218,218,183,175,194,183,194,24,1,1,140,2,143,140,143,142,177,177,100,121,172,100,172,29,156,156,210,35,109,210,109,241,73,73,224,146,59,224,59,114,216,216,180,171,199,180,199,31,172,172,250,67,21,250,21,185,243,243,7,253,9,7,9,250,207,207,37,133,111,37,111,160,202,202,175,143,234,175,234,32,244,244,142,243,137,142,137,125,71,71,233,142,32,233,32,103,16,16,24,32,40,24,40,56,111,111,213,222,100,213,100,11,240,240,136,251,131,136,131,115,74,74,111,148,177,111,177,251,92,92,114,184,150,114,150,202,56,56,36,112,108,36,108,84,87,87,241,174,8,241,8,95,115,115,199,230,82,199,82,33,151,151,81,53,243,81,243,100,203,203,35,141,101,35,101,174,161,161,124,89,132,124,132,37,232,232,156,203,191,156,191,87,62,62,33,124,99,33,99,93,150,150,221,55,124,221,124,234,97,97,220,194,127,220,127,30,13,13,134,26,145,134,145,156,15,15,133,30,148,133,148,155,224,224,144,219,171,144,171,75,124,124,66,248,198,66,198,186,113,113,196,226,87,196,87,38,204,204,170,131,229,170,229,41,144,144,216,59,115,216,115,227,6,6,5,12,15,5,15,9,247,247,1,245,3,1,3,244,28,28,18,56,54,18,54,42,194,194,163,159,254,163,254,60,106,106,95,212,225,95,225,139,174,174,249,71,16,249,16,190,105,105,208,210,107,208,107,2,23,23,145,46,168,145,168,191,153,153,88,41,232,88,232,113,58,58,39,116,105,39,105,83,39,39,185,78,208,185,208,247,217,217,56,169,72,56,72,145,235,235,19,205,53,19,53,222,43,43,179,86,206,179,206,229,34,34,51,68,85,51,85,119,210,210,187,191,214,187,214,4,169,169,112,73,144,112,144,57,7,7,137,14,128,137,128,135,51,51,167,102,242,167,242,193,45,45,182,90,193,182,193,236,60,60,34,120,102,34,102,90,21,21,146,42,173,146,173,184,201,201,32,137,96,32,96,169,135,135,73,21,219,73,219,92,170,170,255,79,26,255,26,176,80,80,120,160,136,120,136,216,165,165,122,81,142,122,142,43,3,3,143,6,138,143,138,137,89,89,248,178,19,248,19,74,9,9,128,18,155,128,155,146,26,26,23,52,57,23,57,35,101,101,218,202,117,218,117,16,215,215,49,181,83,49,83,132,132,132,198,19,81,198,81,213,208,208,184,187,211,184,211,3,130,130,195,31,94,195,94,220,41,41,176,82,203,176,203,226,90,90,119,180,153,119,153,195,30,30,17,60,51,17,51,45,123,123,203,246,70,203,70,61,168,168,252,75,31,252,31,183,109,109,214,218,97,214,97,12,44,44,58,88,78,58,78,98,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+10240);




var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

    HEAP8[tempDoublePtr] = HEAP8[ptr];

    HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

    HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

    HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

    HEAP8[tempDoublePtr] = HEAP8[ptr];

    HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

    HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

    HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

    HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

    HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

    HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

    HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}



Module["_i64Add"] = _i64Add;


Module["_memset"] = _memset;


Module["_bitshift64Lshr"] = _bitshift64Lshr;


Module["_bitshift64Shl"] = _bitshift64Shl;

function _abort() {
    Module['abort']();
}


Module["_strlen"] = _strlen;


function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
    return dest;
}
Module["_memcpy"] = _memcpy;



var ___errno_state=0;function ___setErrNo(value) {
    // For convenient setting and returning of errno.
    HEAP32[((___errno_state)>>2)]=value;
    return value;
}

var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _sysconf(name) {
    // long sysconf(int name);
    // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
    switch(name) {
        case 30: return PAGE_SIZE;
        case 132:
        case 133:
        case 12:
        case 137:
        case 138:
        case 15:
        case 235:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 149:
        case 13:
        case 10:
        case 236:
        case 153:
        case 9:
        case 21:
        case 22:
        case 159:
        case 154:
        case 14:
        case 77:
        case 78:
        case 139:
        case 80:
        case 81:
        case 79:
        case 82:
        case 68:
        case 67:
        case 164:
        case 11:
        case 29:
        case 47:
        case 48:
        case 95:
        case 52:
        case 51:
        case 46:
            return 200809;
        case 27:
        case 246:
        case 127:
        case 128:
        case 23:
        case 24:
        case 160:
        case 161:
        case 181:
        case 182:
        case 242:
        case 183:
        case 184:
        case 243:
        case 244:
        case 245:
        case 165:
        case 178:
        case 179:
        case 49:
        case 50:
        case 168:
        case 169:
        case 175:
        case 170:
        case 171:
        case 172:
        case 97:
        case 76:
        case 32:
        case 173:
        case 35:
            return -1;
        case 176:
        case 177:
        case 7:
        case 155:
        case 8:
        case 157:
        case 125:
        case 126:
        case 92:
        case 93:
        case 129:
        case 130:
        case 131:
        case 94:
        case 91:
            return 1;
        case 74:
        case 60:
        case 69:
        case 70:
        case 4:
            return 1024;
        case 31:
        case 42:
        case 72:
            return 32;
        case 87:
        case 26:
        case 33:
            return 2147483647;
        case 34:
        case 1:
            return 47839;
        case 38:
        case 36:
            return 99;
        case 43:
        case 37:
            return 2048;
        case 0: return 2097152;
        case 3: return 65536;
        case 28: return 32768;
        case 44: return 32767;
        case 75: return 16384;
        case 39: return 1000;
        case 89: return 700;
        case 71: return 256;
        case 40: return 255;
        case 2: return 100;
        case 180: return 64;
        case 25: return 20;
        case 5: return 16;
        case 6: return 6;
        case 73: return 4;
        case 84: return 1;
    }
    ___setErrNo(ERRNO_CODES.EINVAL);
    return -1;
}

function _sbrk(bytes) {
    // Implement a Linux-like 'memory area' for our 'process'.
    // Changes the size of the memory area by |bytes|; returns the
    // address of the previous top ('break') of the memory area
    // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
    var self = _sbrk;
    if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
    }
    var ret = DYNAMICTOP;
    if (bytes != 0) self.alloc(bytes);
    return ret;  // Previous break location.
}

function ___errno_location() {
    return ___errno_state;
}

var _llvm_memcpy_p0i8_p0i8_i32=_memcpy;




var ERRNO_MESSAGES={0:"Success",1:"Not super-user",2:"No such file or directory",3:"No such process",4:"Interrupted system call",5:"I/O error",6:"No such device or address",7:"Arg list too long",8:"Exec format error",9:"Bad file number",10:"No children",11:"No more processes",12:"Not enough core",13:"Permission denied",14:"Bad address",15:"Block device required",16:"Mount device busy",17:"File exists",18:"Cross-device link",19:"No such device",20:"Not a directory",21:"Is a directory",22:"Invalid argument",23:"Too many open files in system",24:"Too many open files",25:"Not a typewriter",26:"Text file busy",27:"File too large",28:"No space left on device",29:"Illegal seek",30:"Read only file system",31:"Too many links",32:"Broken pipe",33:"Math arg out of domain of func",34:"Math result not representable",35:"File locking deadlock error",36:"File or path name too long",37:"No record locks available",38:"Function not implemented",39:"Directory not empty",40:"Too many symbolic links",42:"No message of desired type",43:"Identifier removed",44:"Channel number out of range",45:"Level 2 not synchronized",46:"Level 3 halted",47:"Level 3 reset",48:"Link number out of range",49:"Protocol driver not attached",50:"No CSI structure available",51:"Level 2 halted",52:"Invalid exchange",53:"Invalid request descriptor",54:"Exchange full",55:"No anode",56:"Invalid request code",57:"Invalid slot",59:"Bad font file fmt",60:"Device not a stream",61:"No data (for no delay io)",62:"Timer expired",63:"Out of streams resources",64:"Machine is not on the network",65:"Package not installed",66:"The object is remote",67:"The link has been severed",68:"Advertise error",69:"Srmount error",70:"Communication error on send",71:"Protocol error",72:"Multihop attempted",73:"Cross mount point (not really error)",74:"Trying to read unreadable message",75:"Value too large for defined data type",76:"Given log. name not unique",77:"f.d. invalid for this operation",78:"Remote address changed",79:"Can   access a needed shared lib",80:"Accessing a corrupted shared lib",81:".lib section in a.out corrupted",82:"Attempting to link in too many libs",83:"Attempting to exec a shared library",84:"Illegal byte sequence",86:"Streams pipe error",87:"Too many users",88:"Socket operation on non-socket",89:"Destination address required",90:"Message too long",91:"Protocol wrong type for socket",92:"Protocol not available",93:"Unknown protocol",94:"Socket type not supported",95:"Not supported",96:"Protocol family not supported",97:"Address family not supported by protocol family",98:"Address already in use",99:"Address not available",100:"Network interface is not configured",101:"Network is unreachable",102:"Connection reset by network",103:"Connection aborted",104:"Connection reset by peer",105:"No buffer space available",106:"Socket is already connected",107:"Socket is not connected",108:"Can't send after socket shutdown",109:"Too many references",110:"Connection timed out",111:"Connection refused",112:"Host is down",113:"Host is unreachable",114:"Socket already connected",115:"Connection already in progress",116:"Stale file handle",122:"Quota exceeded",123:"No medium (in tape drive)",125:"Operation canceled",130:"Previous owner died",131:"State not recoverable"};

var TTY={ttys:[],init:function () {
    // https://github.com/kripken/emscripten/pull/1555
    // if (ENVIRONMENT_IS_NODE) {
    //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
    //   // device, it always assumes it's a TTY device. because of this, we're forcing
    //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
    //   // with text files until FS.init can be refactored.
    //   process['stdin']['setEncoding']('utf8');
    // }
},shutdown:function () {
    // https://github.com/kripken/emscripten/pull/1555
    // if (ENVIRONMENT_IS_NODE) {
    //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
    //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
    //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
    //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
    //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
    //   process['stdin']['pause']();
    // }
},register:function (dev, ops) {
    TTY.ttys[dev] = { input: [], output: [], ops: ops };
    FS.registerDevice(dev, TTY.stream_ops);
},stream_ops:{open:function (stream) {
    var tty = TTY.ttys[stream.node.rdev];
    if (!tty) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
    }
    stream.tty = tty;
    stream.seekable = false;
},close:function (stream) {
    // flush any pending line data
    if (stream.tty.output.length) {
        stream.tty.ops.put_char(stream.tty, 10);
    }
},read:function (stream, buffer, offset, length, pos /* ignored */) {
    if (!stream.tty || !stream.tty.ops.get_char) {
        throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
    }
    var bytesRead = 0;
    for (var i = 0; i < length; i++) {
        var result;
        try {
            result = stream.tty.ops.get_char(stream.tty);
        } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
        }
        if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
        }
        if (result === null || result === undefined) break;
        bytesRead++;
        buffer[offset+i] = result;
    }
    if (bytesRead) {
        stream.node.timestamp = Date.now();
    }
    return bytesRead;
},write:function (stream, buffer, offset, length, pos) {
    if (!stream.tty || !stream.tty.ops.put_char) {
        throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
    }
    for (var i = 0; i < length; i++) {
        try {
            stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
        } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
        }
    }
    if (length) {
        stream.node.timestamp = Date.now();
    }
    return i;
}},default_tty_ops:{get_char:function (tty) {
    if (!tty.input.length) {
        var result = null;
        if (ENVIRONMENT_IS_NODE) {
            result = process['stdin']['read']();
            if (!result) {
                if (process['stdin']['_readableState'] && process['stdin']['_readableState']['ended']) {
                    return null;  // EOF
                }
                return undefined;  // no data available
            }
        } else if (typeof window != 'undefined' &&
            typeof window.prompt == 'function') {
            // Browser.
            result = window.prompt('Input: ');  // returns null on cancel
            if (result !== null) {
                result += '\n';
            }
        } else if (typeof readline == 'function') {
            // Command line.
            result = readline();
            if (result !== null) {
                result += '\n';
            }
        }
        if (!result) {
            return null;
        }
        tty.input = intArrayFromString(result, true);
    }
    return tty.input.shift();
},put_char:function (tty, val) {
    if (val === null || val === 10) {
        Module['print'](tty.output.join(''));
        tty.output = [];
    } else {
        tty.output.push(TTY.utf8.processCChar(val));
    }
}},default_tty1_ops:{put_char:function (tty, val) {
    if (val === null || val === 10) {
        Module['printErr'](tty.output.join(''));
        tty.output = [];
    } else {
        tty.output.push(TTY.utf8.processCChar(val));
    }
}}};

var MEMFS={ops_table:null,CONTENT_OWNING:1,CONTENT_FLEXIBLE:2,CONTENT_FIXED:3,mount:function (mount) {
    return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
},createNode:function (parent, name, mode, dev) {
    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
        // no supported
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    if (!MEMFS.ops_table) {
        MEMFS.ops_table = {
            dir: {
                node: {
                    getattr: MEMFS.node_ops.getattr,
                    setattr: MEMFS.node_ops.setattr,
                    lookup: MEMFS.node_ops.lookup,
                    mknod: MEMFS.node_ops.mknod,
                    rename: MEMFS.node_ops.rename,
                    unlink: MEMFS.node_ops.unlink,
                    rmdir: MEMFS.node_ops.rmdir,
                    readdir: MEMFS.node_ops.readdir,
                    symlink: MEMFS.node_ops.symlink
                },
                stream: {
                    llseek: MEMFS.stream_ops.llseek
                }
            },
            file: {
                node: {
                    getattr: MEMFS.node_ops.getattr,
                    setattr: MEMFS.node_ops.setattr
                },
                stream: {
                    llseek: MEMFS.stream_ops.llseek,
                    read: MEMFS.stream_ops.read,
                    write: MEMFS.stream_ops.write,
                    allocate: MEMFS.stream_ops.allocate,
                    mmap: MEMFS.stream_ops.mmap
                }
            },
            link: {
                node: {
                    getattr: MEMFS.node_ops.getattr,
                    setattr: MEMFS.node_ops.setattr,
                    readlink: MEMFS.node_ops.readlink
                },
                stream: {}
            },
            chrdev: {
                node: {
                    getattr: MEMFS.node_ops.getattr,
                    setattr: MEMFS.node_ops.setattr
                },
                stream: FS.chrdev_stream_ops
            },
        };
    }
    var node = FS.createNode(parent, name, mode, dev);
    if (FS.isDir(node.mode)) {
        node.node_ops = MEMFS.ops_table.dir.node;
        node.stream_ops = MEMFS.ops_table.dir.stream;
        node.contents = {};
    } else if (FS.isFile(node.mode)) {
        node.node_ops = MEMFS.ops_table.file.node;
        node.stream_ops = MEMFS.ops_table.file.stream;
        node.contents = [];
        node.contentMode = MEMFS.CONTENT_FLEXIBLE;
    } else if (FS.isLink(node.mode)) {
        node.node_ops = MEMFS.ops_table.link.node;
        node.stream_ops = MEMFS.ops_table.link.stream;
    } else if (FS.isChrdev(node.mode)) {
        node.node_ops = MEMFS.ops_table.chrdev.node;
        node.stream_ops = MEMFS.ops_table.chrdev.stream;
    }
    node.timestamp = Date.now();
    // add the new node to the parent
    if (parent) {
        parent.contents[name] = node;
    }
    return node;
},ensureFlexible:function (node) {
    if (node.contentMode !== MEMFS.CONTENT_FLEXIBLE) {
        var contents = node.contents;
        node.contents = Array.prototype.slice.call(contents);
        node.contentMode = MEMFS.CONTENT_FLEXIBLE;
    }
},node_ops:{getattr:function (node) {
    var attr = {};
    // device numbers reuse inode numbers.
    attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
    attr.ino = node.id;
    attr.mode = node.mode;
    attr.nlink = 1;
    attr.uid = 0;
    attr.gid = 0;
    attr.rdev = node.rdev;
    if (FS.isDir(node.mode)) {
        attr.size = 4096;
    } else if (FS.isFile(node.mode)) {
        attr.size = node.contents.length;
    } else if (FS.isLink(node.mode)) {
        attr.size = node.link.length;
    } else {
        attr.size = 0;
    }
    attr.atime = new Date(node.timestamp);
    attr.mtime = new Date(node.timestamp);
    attr.ctime = new Date(node.timestamp);
    // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
    //       but this is not required by the standard.
    attr.blksize = 4096;
    attr.blocks = Math.ceil(attr.size / attr.blksize);
    return attr;
},setattr:function (node, attr) {
    if (attr.mode !== undefined) {
        node.mode = attr.mode;
    }
    if (attr.timestamp !== undefined) {
        node.timestamp = attr.timestamp;
    }
    if (attr.size !== undefined) {
        MEMFS.ensureFlexible(node);
        var contents = node.contents;
        if (attr.size < contents.length) contents.length = attr.size;
        else while (attr.size > contents.length) contents.push(0);
    }
},lookup:function (parent, name) {
    throw FS.genericErrors[ERRNO_CODES.ENOENT];
},mknod:function (parent, name, mode, dev) {
    return MEMFS.createNode(parent, name, mode, dev);
},rename:function (old_node, new_dir, new_name) {
    // if we're overwriting a directory at new_name, make sure it's empty.
    if (FS.isDir(old_node.mode)) {
        var new_node;
        try {
            new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
        }
        if (new_node) {
            for (var i in new_node.contents) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
            }
        }
    }
    // do the internal rewiring
    delete old_node.parent.contents[old_node.name];
    old_node.name = new_name;
    new_dir.contents[new_name] = old_node;
    old_node.parent = new_dir;
},unlink:function (parent, name) {
    delete parent.contents[name];
},rmdir:function (parent, name) {
    var node = FS.lookupNode(parent, name);
    for (var i in node.contents) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
    }
    delete parent.contents[name];
},readdir:function (node) {
    var entries = ['.', '..']
    for (var key in node.contents) {
        if (!node.contents.hasOwnProperty(key)) {
            continue;
        }
        entries.push(key);
    }
    return entries;
},symlink:function (parent, newname, oldpath) {
    var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
    node.link = oldpath;
    return node;
},readlink:function (node) {
    if (!FS.isLink(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    return node.link;
}},stream_ops:{read:function (stream, buffer, offset, length, position) {
    var contents = stream.node.contents;
    if (position >= contents.length)
        return 0;
    var size = Math.min(contents.length - position, length);
    assert(size >= 0);
    if (size > 8 && contents.subarray) { // non-trivial, and typed array
        buffer.set(contents.subarray(position, position + size), offset);
    } else
    {
        for (var i = 0; i < size; i++) {
            buffer[offset + i] = contents[position + i];
        }
    }
    return size;
},write:function (stream, buffer, offset, length, position, canOwn) {
    var node = stream.node;
    node.timestamp = Date.now();
    var contents = node.contents;
    if (length && contents.length === 0 && position === 0 && buffer.subarray) {
        // just replace it with the new data
        if (canOwn && offset === 0) {
            node.contents = buffer; // this could be a subarray of Emscripten HEAP, or allocated from some other source.
            node.contentMode = (buffer.buffer === HEAP8.buffer) ? MEMFS.CONTENT_OWNING : MEMFS.CONTENT_FIXED;
        } else {
            node.contents = new Uint8Array(buffer.subarray(offset, offset+length));
            node.contentMode = MEMFS.CONTENT_FIXED;
        }
        return length;
    }
    MEMFS.ensureFlexible(node);
    var contents = node.contents;
    while (contents.length < position) contents.push(0);
    for (var i = 0; i < length; i++) {
        contents[position + i] = buffer[offset + i];
    }
    return length;
},llseek:function (stream, offset, whence) {
    var position = offset;
    if (whence === 1) {  // SEEK_CUR.
        position += stream.position;
    } else if (whence === 2) {  // SEEK_END.
        if (FS.isFile(stream.node.mode)) {
            position += stream.node.contents.length;
        }
    }
    if (position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    stream.ungotten = [];
    stream.position = position;
    return position;
},allocate:function (stream, offset, length) {
    MEMFS.ensureFlexible(stream.node);
    var contents = stream.node.contents;
    var limit = offset + length;
    while (limit > contents.length) contents.push(0);
},mmap:function (stream, buffer, offset, length, position, prot, flags) {
    if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
    }
    var ptr;
    var allocated;
    var contents = stream.node.contents;
    // Only make a new copy when MAP_PRIVATE is specified.
    if ( !(flags & 2) &&
        (contents.buffer === buffer || contents.buffer === buffer.buffer) ) {
        // We can't emulate MAP_SHARED when the file is not backed by the buffer
        // we're mapping to (e.g. the HEAP buffer).
        allocated = false;
        ptr = contents.byteOffset;
    } else {
        // Try to avoid unnecessary slices.
        if (position > 0 || position + length < contents.length) {
            if (contents.subarray) {
                contents = contents.subarray(position, position + length);
            } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
            }
        }
        allocated = true;
        ptr = _malloc(length);
        if (!ptr) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
        }
        buffer.set(contents, ptr);
    }
    return { ptr: ptr, allocated: allocated };
}}};

var IDBFS={dbs:{},indexedDB:function () {
    return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
},DB_VERSION:21,DB_STORE_NAME:"FILE_DATA",mount:function (mount) {
    // reuse all of the core MEMFS functionality
    return MEMFS.mount.apply(null, arguments);
},syncfs:function (mount, populate, callback) {
    IDBFS.getLocalSet(mount, function(err, local) {
        if (err) return callback(err);

        IDBFS.getRemoteSet(mount, function(err, remote) {
            if (err) return callback(err);

            var src = populate ? remote : local;
            var dst = populate ? local : remote;

            IDBFS.reconcile(src, dst, callback);
        });
    });
},getDB:function (name, callback) {
    // check the cache first
    var db = IDBFS.dbs[name];
    if (db) {
        return callback(null, db);
    }

    var req;
    try {
        req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
    } catch (e) {
        return callback(e);
    }
    req.onupgradeneeded = function(e) {
        var db = e.target.result;
        var transaction = e.target.transaction;

        var fileStore;

        if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
            fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
        } else {
            fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
        }

        fileStore.createIndex('timestamp', 'timestamp', { unique: false });
    };
    req.onsuccess = function() {
        db = req.result;

        // add to the cache
        IDBFS.dbs[name] = db;
        callback(null, db);
    };
    req.onerror = function() {
        callback(this.error);
    };
},getLocalSet:function (mount, callback) {
    var entries = {};

    function isRealDir(p) {
        return p !== '.' && p !== '..';
    };
    function toAbsolute(root) {
        return function(p) {
            return PATH.join2(root, p);
        }
    };

    var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));

    while (check.length) {
        var path = check.pop();
        var stat;

        try {
            stat = FS.stat(path);
        } catch (e) {
            return callback(e);
        }

        if (FS.isDir(stat.mode)) {
            check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
        }

        entries[path] = { timestamp: stat.mtime };
    }

    return callback(null, { type: 'local', entries: entries });
},getRemoteSet:function (mount, callback) {
    var entries = {};

    IDBFS.getDB(mount.mountpoint, function(err, db) {
        if (err) return callback(err);

        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
        transaction.onerror = function() { callback(this.error); };

        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
        var index = store.index('timestamp');

        index.openKeyCursor().onsuccess = function(event) {
            var cursor = event.target.result;

            if (!cursor) {
                return callback(null, { type: 'remote', db: db, entries: entries });
            }

            entries[cursor.primaryKey] = { timestamp: cursor.key };

            cursor.continue();
        };
    });
},loadLocalEntry:function (path, callback) {
    var stat, node;

    try {
        var lookup = FS.lookupPath(path);
        node = lookup.node;
        stat = FS.stat(path);
    } catch (e) {
        return callback(e);
    }

    if (FS.isDir(stat.mode)) {
        return callback(null, { timestamp: stat.mtime, mode: stat.mode });
    } else if (FS.isFile(stat.mode)) {
        return callback(null, { timestamp: stat.mtime, mode: stat.mode, contents: node.contents });
    } else {
        return callback(new Error('node type not supported'));
    }
},storeLocalEntry:function (path, entry, callback) {
    try {
        if (FS.isDir(entry.mode)) {
            FS.mkdir(path, entry.mode);
        } else if (FS.isFile(entry.mode)) {
            FS.writeFile(path, entry.contents, { encoding: 'binary', canOwn: true });
        } else {
            return callback(new Error('node type not supported'));
        }

        FS.utime(path, entry.timestamp, entry.timestamp);
    } catch (e) {
        return callback(e);
    }

    callback(null);
},removeLocalEntry:function (path, callback) {
    try {
        var lookup = FS.lookupPath(path);
        var stat = FS.stat(path);

        if (FS.isDir(stat.mode)) {
            FS.rmdir(path);
        } else if (FS.isFile(stat.mode)) {
            FS.unlink(path);
        }
    } catch (e) {
        return callback(e);
    }

    callback(null);
},loadRemoteEntry:function (store, path, callback) {
    var req = store.get(path);
    req.onsuccess = function(event) { callback(null, event.target.result); };
    req.onerror = function() { callback(this.error); };
},storeRemoteEntry:function (store, path, entry, callback) {
    var req = store.put(entry, path);
    req.onsuccess = function() { callback(null); };
    req.onerror = function() { callback(this.error); };
},removeRemoteEntry:function (store, path, callback) {
    var req = store.delete(path);
    req.onsuccess = function() { callback(null); };
    req.onerror = function() { callback(this.error); };
},reconcile:function (src, dst, callback) {
    var total = 0;

    var create = [];
    Object.keys(src.entries).forEach(function (key) {
        var e = src.entries[key];
        var e2 = dst.entries[key];
        if (!e2 || e.timestamp > e2.timestamp) {
            create.push(key);
            total++;
        }
    });

    var remove = [];
    Object.keys(dst.entries).forEach(function (key) {
        var e = dst.entries[key];
        var e2 = src.entries[key];
        if (!e2) {
            remove.push(key);
            total++;
        }
    });

    if (!total) {
        return callback(null);
    }

    var errored = false;
    var completed = 0;
    var db = src.type === 'remote' ? src.db : dst.db;
    var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
    var store = transaction.objectStore(IDBFS.DB_STORE_NAME);

    function done(err) {
        if (err) {
            if (!done.errored) {
                done.errored = true;
                return callback(err);
            }
            return;
        }
        if (++completed >= total) {
            return callback(null);
        }
    };

    transaction.onerror = function() { done(this.error); };

    // sort paths in ascending order so directory entries are created
    // before the files inside them
    create.sort().forEach(function (path) {
        if (dst.type === 'local') {
            IDBFS.loadRemoteEntry(store, path, function (err, entry) {
                if (err) return done(err);
                IDBFS.storeLocalEntry(path, entry, done);
            });
        } else {
            IDBFS.loadLocalEntry(path, function (err, entry) {
                if (err) return done(err);
                IDBFS.storeRemoteEntry(store, path, entry, done);
            });
        }
    });

    // sort paths in descending order so files are deleted before their
    // parent directories
    remove.sort().reverse().forEach(function(path) {
        if (dst.type === 'local') {
            IDBFS.removeLocalEntry(path, done);
        } else {
            IDBFS.removeRemoteEntry(store, path, done);
        }
    });
}};

var NODEFS={isWindows:false,staticInit:function () {
    NODEFS.isWindows = !!process.platform.match(/^win/);
},mount:function (mount) {
    assert(ENVIRONMENT_IS_NODE);
    return NODEFS.createNode(null, '/', NODEFS.getMode(mount.opts.root), 0);
},createNode:function (parent, name, mode, dev) {
    if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    var node = FS.createNode(parent, name, mode);
    node.node_ops = NODEFS.node_ops;
    node.stream_ops = NODEFS.stream_ops;
    return node;
},getMode:function (path) {
    var stat;
    try {
        stat = fs.lstatSync(path);
        if (NODEFS.isWindows) {
            // On Windows, directories return permission bits 'rw-rw-rw-', even though they have 'rwxrwxrwx', so 
            // propagate write bits to execute bits.
            stat.mode = stat.mode | ((stat.mode & 146) >> 1);
        }
    } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
    return stat.mode;
},realPath:function (node) {
    var parts = [];
    while (node.parent !== node) {
        parts.push(node.name);
        node = node.parent;
    }
    parts.push(node.mount.opts.root);
    parts.reverse();
    return PATH.join.apply(null, parts);
},flagsToPermissionStringMap:{0:"r",1:"r+",2:"r+",64:"r",65:"r+",66:"r+",129:"rx+",193:"rx+",514:"w+",577:"w",578:"w+",705:"wx",706:"wx+",1024:"a",1025:"a",1026:"a+",1089:"a",1090:"a+",1153:"ax",1154:"ax+",1217:"ax",1218:"ax+",4096:"rs",4098:"rs+"},flagsToPermissionString:function (flags) {
    if (flags in NODEFS.flagsToPermissionStringMap) {
        return NODEFS.flagsToPermissionStringMap[flags];
    } else {
        return flags;
    }
},node_ops:{getattr:function (node) {
    var path = NODEFS.realPath(node);
    var stat;
    try {
        stat = fs.lstatSync(path);
    } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
    // node.js v0.10.20 doesn't report blksize and blocks on Windows. Fake them with default blksize of 4096.
    // See http://support.microsoft.com/kb/140365
    if (NODEFS.isWindows && !stat.blksize) {
        stat.blksize = 4096;
    }
    if (NODEFS.isWindows && !stat.blocks) {
        stat.blocks = (stat.size+stat.blksize-1)/stat.blksize|0;
    }
    return {
        dev: stat.dev,
        ino: stat.ino,
        mode: stat.mode,
        nlink: stat.nlink,
        uid: stat.uid,
        gid: stat.gid,
        rdev: stat.rdev,
        size: stat.size,
        atime: stat.atime,
        mtime: stat.mtime,
        ctime: stat.ctime,
        blksize: stat.blksize,
        blocks: stat.blocks
    };
},setattr:function (node, attr) {
    var path = NODEFS.realPath(node);
    try {
        if (attr.mode !== undefined) {
            fs.chmodSync(path, attr.mode);
            // update the common node structure mode as well
            node.mode = attr.mode;
        }
        if (attr.timestamp !== undefined) {
            var date = new Date(attr.timestamp);
            fs.utimesSync(path, date, date);
        }
        if (attr.size !== undefined) {
            fs.truncateSync(path, attr.size);
        }
    } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
},lookup:function (parent, name) {
    var path = PATH.join2(NODEFS.realPath(parent), name);
    var mode = NODEFS.getMode(path);
    return NODEFS.createNode(parent, name, mode);
},mknod:function (parent, name, mode, dev) {
    var node = NODEFS.createNode(parent, name, mode, dev);
    // create the backing node for this in the fs root as well
    var path = NODEFS.realPath(node);
    try {
        if (FS.isDir(node.mode)) {
            fs.mkdirSync(path, node.mode);
        } else {
            fs.writeFileSync(path, '', { mode: node.mode });
        }
    } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
    return node;
},rename:function (oldNode, newDir, newName) {
    var oldPath = NODEFS.realPath(oldNode);
    var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
    try {
        fs.renameSync(oldPath, newPath);
    } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
},unlink:function (parent, name) {
    var path = PATH.join2(NODEFS.realPath(parent), name);
    try {
        fs.unlinkSync(path);
    } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
},rmdir:function (parent, name) {
    var path = PATH.join2(NODEFS.realPath(parent), name);
    try {
        fs.rmdirSync(path);
    } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
},readdir:function (node) {
    var path = NODEFS.realPath(node);
    try {
        return fs.readdirSync(path);
    } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
},symlink:function (parent, newName, oldPath) {
    var newPath = PATH.join2(NODEFS.realPath(parent), newName);
    try {
        fs.symlinkSync(oldPath, newPath);
    } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
},readlink:function (node) {
    var path = NODEFS.realPath(node);
    try {
        return fs.readlinkSync(path);
    } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
}},stream_ops:{open:function (stream) {
    var path = NODEFS.realPath(stream.node);
    try {
        if (FS.isFile(stream.node.mode)) {
            stream.nfd = fs.openSync(path, NODEFS.flagsToPermissionString(stream.flags));
        }
    } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
},close:function (stream) {
    try {
        if (FS.isFile(stream.node.mode) && stream.nfd) {
            fs.closeSync(stream.nfd);
        }
    } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
},read:function (stream, buffer, offset, length, position) {
    // FIXME this is terrible.
    var nbuffer = new Buffer(length);
    var res;
    try {
        res = fs.readSync(stream.nfd, nbuffer, 0, length, position);
    } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
    if (res > 0) {
        for (var i = 0; i < res; i++) {
            buffer[offset + i] = nbuffer[i];
        }
    }
    return res;
},write:function (stream, buffer, offset, length, position) {
    // FIXME this is terrible.
    var nbuffer = new Buffer(buffer.subarray(offset, offset + length));
    var res;
    try {
        res = fs.writeSync(stream.nfd, nbuffer, 0, length, position);
    } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
    return res;
},llseek:function (stream, offset, whence) {
    var position = offset;
    if (whence === 1) {  // SEEK_CUR.
        position += stream.position;
    } else if (whence === 2) {  // SEEK_END.
        if (FS.isFile(stream.node.mode)) {
            try {
                var stat = fs.fstatSync(stream.nfd);
                position += stat.size;
            } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES[e.code]);
            }
        }
    }

    if (position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }

    stream.position = position;
    return position;
}}};

var _stdin=allocate(1, "i32*", ALLOC_STATIC);

var _stdout=allocate(1, "i32*", ALLOC_STATIC);

var _stderr=allocate(1, "i32*", ALLOC_STATIC);

function _fflush(stream) {
    // int fflush(FILE *stream);
    // http://pubs.opengroup.org/onlinepubs/000095399/functions/fflush.html
    // we don't currently perform any user-space buffering of data
}var FS={root:null,mounts:[],devices:[null],streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,ErrnoError:null,genericErrors:{},handleFSError:function (e) {
    if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace();
    return ___setErrNo(e.errno);
},lookupPath:function (path, opts) {
    path = PATH.resolve(FS.cwd(), path);
    opts = opts || {};

    var defaults = {
        follow_mount: true,
        recurse_count: 0
    };
    for (var key in defaults) {
        if (opts[key] === undefined) {
            opts[key] = defaults[key];
        }
    }

    if (opts.recurse_count > 8) {  // max recursive lookup of 8
        throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
    }

    // split the path
    var parts = PATH.normalizeArray(path.split('/').filter(function(p) {
        return !!p;
    }), false);

    // start at the root
    var current = FS.root;
    var current_path = '/';

    for (var i = 0; i < parts.length; i++) {
        var islast = (i === parts.length-1);
        if (islast && opts.parent) {
            // stop resolving
            break;
        }

        current = FS.lookupNode(current, parts[i]);
        current_path = PATH.join2(current_path, parts[i]);

        // jump to the mount's root node if this is a mountpoint
        if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
                current = current.mounted.root;
            }
        }

        // by default, lookupPath will not follow a symlink if it is the final path component.
        // setting opts.follow = true will override this behavior.
        if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
                var link = FS.readlink(current_path);
                current_path = PATH.resolve(PATH.dirname(current_path), link);

                var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
                current = lookup.node;

                if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                    throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
                }
            }
        }
    }

    return { path: current_path, node: current };
},getPath:function (node) {
    var path;
    while (true) {
        if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? mount + '/' + path : mount + path;
        }
        path = path ? node.name + '/' + path : node.name;
        node = node.parent;
    }
},hashName:function (parentid, name) {
    var hash = 0;


    for (var i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    return ((parentid + hash) >>> 0) % FS.nameTable.length;
},hashAddNode:function (node) {
    var hash = FS.hashName(node.parent.id, node.name);
    node.name_next = FS.nameTable[hash];
    FS.nameTable[hash] = node;
},hashRemoveNode:function (node) {
    var hash = FS.hashName(node.parent.id, node.name);
    if (FS.nameTable[hash] === node) {
        FS.nameTable[hash] = node.name_next;
    } else {
        var current = FS.nameTable[hash];
        while (current) {
            if (current.name_next === node) {
                current.name_next = node.name_next;
                break;
            }
            current = current.name_next;
        }
    }
},lookupNode:function (parent, name) {
    var err = FS.mayLookup(parent);
    if (err) {
        throw new FS.ErrnoError(err);
    }
    var hash = FS.hashName(parent.id, name);
    for (var node = FS.nameTable[hash]; node; node = node.name_next) {
        var nodeName = node.name;
        if (node.parent.id === parent.id && nodeName === name) {
            return node;
        }
    }
    // if we failed to find it in the cache, call into the VFS
    return FS.lookup(parent, name);
},createNode:function (parent, name, mode, rdev) {
    if (!FS.FSNode) {
        FS.FSNode = function(parent, name, mode, rdev) {
            if (!parent) {
                parent = this;  // root node sets parent to itself
            }
            this.parent = parent;
            this.mount = parent.mount;
            this.mounted = null;
            this.id = FS.nextInode++;
            this.name = name;
            this.mode = mode;
            this.node_ops = {};
            this.stream_ops = {};
            this.rdev = rdev;
        };

        FS.FSNode.prototype = {};

        // compatibility
        var readMode = 292 | 73;
        var writeMode = 146;

        // NOTE we must use Object.defineProperties instead of individual calls to
        // Object.defineProperty in order to make closure compiler happy
        Object.defineProperties(FS.FSNode.prototype, {
            read: {
                get: function() { return (this.mode & readMode) === readMode; },
                set: function(val) { val ? this.mode |= readMode : this.mode &= ~readMode; }
            },
            write: {
                get: function() { return (this.mode & writeMode) === writeMode; },
                set: function(val) { val ? this.mode |= writeMode : this.mode &= ~writeMode; }
            },
            isFolder: {
                get: function() { return FS.isDir(this.mode); },
            },
            isDevice: {
                get: function() { return FS.isChrdev(this.mode); },
            },
        });
    }

    var node = new FS.FSNode(parent, name, mode, rdev);

    FS.hashAddNode(node);

    return node;
},destroyNode:function (node) {
    FS.hashRemoveNode(node);
},isRoot:function (node) {
    return node === node.parent;
},isMountpoint:function (node) {
    return !!node.mounted;
},isFile:function (mode) {
    return (mode & 61440) === 32768;
},isDir:function (mode) {
    return (mode & 61440) === 16384;
},isLink:function (mode) {
    return (mode & 61440) === 40960;
},isChrdev:function (mode) {
    return (mode & 61440) === 8192;
},isBlkdev:function (mode) {
    return (mode & 61440) === 24576;
},isFIFO:function (mode) {
    return (mode & 61440) === 4096;
},isSocket:function (mode) {
    return (mode & 49152) === 49152;
},flagModes:{"r":0,"rs":1052672,"r+":2,"w":577,"wx":705,"xw":705,"w+":578,"wx+":706,"xw+":706,"a":1089,"ax":1217,"xa":1217,"a+":1090,"ax+":1218,"xa+":1218},modeStringToFlags:function (str) {
    var flags = FS.flagModes[str];
    if (typeof flags === 'undefined') {
        throw new Error('Unknown file open mode: ' + str);
    }
    return flags;
},flagsToPermissionString:function (flag) {
    var accmode = flag & 2097155;
    var perms = ['r', 'w', 'rw'][accmode];
    if ((flag & 512)) {
        perms += 'w';
    }
    return perms;
},nodePermissions:function (node, perms) {
    if (FS.ignorePermissions) {
        return 0;
    }
    // return 0 if any user, group or owner bits are set.
    if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
        return ERRNO_CODES.EACCES;
    } else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
        return ERRNO_CODES.EACCES;
    } else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
        return ERRNO_CODES.EACCES;
    }
    return 0;
},mayLookup:function (dir) {
    return FS.nodePermissions(dir, 'x');
},mayCreate:function (dir, name) {
    try {
        var node = FS.lookupNode(dir, name);
        return ERRNO_CODES.EEXIST;
    } catch (e) {
    }
    return FS.nodePermissions(dir, 'wx');
},mayDelete:function (dir, name, isdir) {
    var node;
    try {
        node = FS.lookupNode(dir, name);
    } catch (e) {
        return e.errno;
    }
    var err = FS.nodePermissions(dir, 'wx');
    if (err) {
        return err;
    }
    if (isdir) {
        if (!FS.isDir(node.mode)) {
            return ERRNO_CODES.ENOTDIR;
        }
        if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return ERRNO_CODES.EBUSY;
        }
    } else {
        if (FS.isDir(node.mode)) {
            return ERRNO_CODES.EISDIR;
        }
    }
    return 0;
},mayOpen:function (node, flags) {
    if (!node) {
        return ERRNO_CODES.ENOENT;
    }
    if (FS.isLink(node.mode)) {
        return ERRNO_CODES.ELOOP;
    } else if (FS.isDir(node.mode)) {
        if ((flags & 2097155) !== 0 ||  // opening for write
            (flags & 512)) {
            return ERRNO_CODES.EISDIR;
        }
    }
    return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
},MAX_OPEN_FDS:4096,nextfd:function (fd_start, fd_end) {
    fd_start = fd_start || 0;
    fd_end = fd_end || FS.MAX_OPEN_FDS;
    for (var fd = fd_start; fd <= fd_end; fd++) {
        if (!FS.streams[fd]) {
            return fd;
        }
    }
    throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
},getStream:function (fd) {
    return FS.streams[fd];
},createStream:function (stream, fd_start, fd_end) {
    if (!FS.FSStream) {
        FS.FSStream = function(){};
        FS.FSStream.prototype = {};
        // compatibility
        Object.defineProperties(FS.FSStream.prototype, {
            object: {
                get: function() { return this.node; },
                set: function(val) { this.node = val; }
            },
            isRead: {
                get: function() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
                get: function() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
                get: function() { return (this.flags & 1024); }
            }
        });
    }
    if (stream.__proto__) {
        // reuse the object
        stream.__proto__ = FS.FSStream.prototype;
    } else {
        var newStream = new FS.FSStream();
        for (var p in stream) {
            newStream[p] = stream[p];
        }
        stream = newStream;
    }
    var fd = FS.nextfd(fd_start, fd_end);
    stream.fd = fd;
    FS.streams[fd] = stream;
    return stream;
},closeStream:function (fd) {
    FS.streams[fd] = null;
},getStreamFromPtr:function (ptr) {
    return FS.streams[ptr - 1];
},getPtrForStream:function (stream) {
    return stream ? stream.fd + 1 : 0;
},chrdev_stream_ops:{open:function (stream) {
    var device = FS.getDevice(stream.node.rdev);
    // override node's stream ops with the device's
    stream.stream_ops = device.stream_ops;
    // forward the open call
    if (stream.stream_ops.open) {
        stream.stream_ops.open(stream);
    }
},llseek:function () {
    throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
}},major:function (dev) {
    return ((dev) >> 8);
},minor:function (dev) {
    return ((dev) & 0xff);
},makedev:function (ma, mi) {
    return ((ma) << 8 | (mi));
},registerDevice:function (dev, ops) {
    FS.devices[dev] = { stream_ops: ops };
},getDevice:function (dev) {
    return FS.devices[dev];
},getMounts:function (mount) {
    var mounts = [];
    var check = [mount];

    while (check.length) {
        var m = check.pop();

        mounts.push(m);

        check.push.apply(check, m.mounts);
    }

    return mounts;
},syncfs:function (populate, callback) {
    if (typeof(populate) === 'function') {
        callback = populate;
        populate = false;
    }

    var mounts = FS.getMounts(FS.root.mount);
    var completed = 0;

    function done(err) {
        if (err) {
            if (!done.errored) {
                done.errored = true;
                return callback(err);
            }
            return;
        }
        if (++completed >= mounts.length) {
            callback(null);
        }
    };

    // sync all mounts
    mounts.forEach(function (mount) {
        if (!mount.type.syncfs) {
            return done(null);
        }
        mount.type.syncfs(mount, populate, done);
    });
},mount:function (type, opts, mountpoint) {
    var root = mountpoint === '/';
    var pseudo = !mountpoint;
    var node;

    if (root && FS.root) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
    } else if (!root && !pseudo) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });

        mountpoint = lookup.path;  // use the absolute path
        node = lookup.node;

        if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }

        if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
    }

    var mount = {
        type: type,
        opts: opts,
        mountpoint: mountpoint,
        mounts: []
    };

    // create a root node for the fs
    var mountRoot = type.mount(mount);
    mountRoot.mount = mount;
    mount.root = mountRoot;

    if (root) {
        FS.root = mountRoot;
    } else if (node) {
        // set as a mountpoint
        node.mounted = mount;

        // add the new mount to the current mount's children
        if (node.mount) {
            node.mount.mounts.push(mount);
        }
    }

    return mountRoot;
},unmount:function (mountpoint) {
    var lookup = FS.lookupPath(mountpoint, { follow_mount: false });

    if (!FS.isMountpoint(lookup.node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }

    // destroy the nodes for this mount, and all its child mounts
    var node = lookup.node;
    var mount = node.mounted;
    var mounts = FS.getMounts(mount);

    Object.keys(FS.nameTable).forEach(function (hash) {
        var current = FS.nameTable[hash];

        while (current) {
            var next = current.name_next;

            if (mounts.indexOf(current.mount) !== -1) {
                FS.destroyNode(current);
            }

            current = next;
        }
    });

    // no longer a mountpoint
    node.mounted = null;

    // remove this mount from the child mounts
    var idx = node.mount.mounts.indexOf(mount);
    assert(idx !== -1);
    node.mount.mounts.splice(idx, 1);
},lookup:function (parent, name) {
    return parent.node_ops.lookup(parent, name);
},mknod:function (path, mode, dev) {
    var lookup = FS.lookupPath(path, { parent: true });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var err = FS.mayCreate(parent, name);
    if (err) {
        throw new FS.ErrnoError(err);
    }
    if (!parent.node_ops.mknod) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    return parent.node_ops.mknod(parent, name, mode, dev);
},create:function (path, mode) {
    mode = mode !== undefined ? mode : 438 /* 0666 */;
    mode &= 4095;
    mode |= 32768;
    return FS.mknod(path, mode, 0);
},mkdir:function (path, mode) {
    mode = mode !== undefined ? mode : 511 /* 0777 */;
    mode &= 511 | 512;
    mode |= 16384;
    return FS.mknod(path, mode, 0);
},mkdev:function (path, mode, dev) {
    if (typeof(dev) === 'undefined') {
        dev = mode;
        mode = 438 /* 0666 */;
    }
    mode |= 8192;
    return FS.mknod(path, mode, dev);
},symlink:function (oldpath, newpath) {
    var lookup = FS.lookupPath(newpath, { parent: true });
    var parent = lookup.node;
    var newname = PATH.basename(newpath);
    var err = FS.mayCreate(parent, newname);
    if (err) {
        throw new FS.ErrnoError(err);
    }
    if (!parent.node_ops.symlink) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    return parent.node_ops.symlink(parent, newname, oldpath);
},rename:function (old_path, new_path) {
    var old_dirname = PATH.dirname(old_path);
    var new_dirname = PATH.dirname(new_path);
    var old_name = PATH.basename(old_path);
    var new_name = PATH.basename(new_path);
    // parents must exist
    var lookup, old_dir, new_dir;
    try {
        lookup = FS.lookupPath(old_path, { parent: true });
        old_dir = lookup.node;
        lookup = FS.lookupPath(new_path, { parent: true });
        new_dir = lookup.node;
    } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
    }
    // need to be part of the same mount
    if (old_dir.mount !== new_dir.mount) {
        throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
    }
    // source must exist
    var old_node = FS.lookupNode(old_dir, old_name);
    // old path should not be an ancestor of the new path
    var relative = PATH.relative(old_path, new_dirname);
    if (relative.charAt(0) !== '.') {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    // new path should not be an ancestor of the old path
    relative = PATH.relative(new_path, old_dirname);
    if (relative.charAt(0) !== '.') {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
    }
    // see if the new path already exists
    var new_node;
    try {
        new_node = FS.lookupNode(new_dir, new_name);
    } catch (e) {
        // not fatal
    }
    // early out if nothing needs to change
    if (old_node === new_node) {
        return;
    }
    // we'll need to delete the old entry
    var isdir = FS.isDir(old_node.mode);
    var err = FS.mayDelete(old_dir, old_name, isdir);
    if (err) {
        throw new FS.ErrnoError(err);
    }
    // need delete permissions if we'll be overwriting.
    // need create permissions if new doesn't already exist.
    err = new_node ?
        FS.mayDelete(new_dir, new_name, isdir) :
        FS.mayCreate(new_dir, new_name);
    if (err) {
        throw new FS.ErrnoError(err);
    }
    if (!old_dir.node_ops.rename) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
    }
    // if we are going to change the parent, check write permissions
    if (new_dir !== old_dir) {
        err = FS.nodePermissions(old_dir, 'w');
        if (err) {
            throw new FS.ErrnoError(err);
        }
    }
    // remove the node from the lookup hash
    FS.hashRemoveNode(old_node);
    // do the underlying fs rename
    try {
        old_dir.node_ops.rename(old_node, new_dir, new_name);
    } catch (e) {
        throw e;
    } finally {
        // add the node back to the hash (in case node_ops.rename
        // changed its name)
        FS.hashAddNode(old_node);
    }
},rmdir:function (path) {
    var lookup = FS.lookupPath(path, { parent: true });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var err = FS.mayDelete(parent, name, true);
    if (err) {
        throw new FS.ErrnoError(err);
    }
    if (!parent.node_ops.rmdir) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
    }
    parent.node_ops.rmdir(parent, name);
    FS.destroyNode(node);
},readdir:function (path) {
    var lookup = FS.lookupPath(path, { follow: true });
    var node = lookup.node;
    if (!node.node_ops.readdir) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
    }
    return node.node_ops.readdir(node);
},unlink:function (path) {
    var lookup = FS.lookupPath(path, { parent: true });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var err = FS.mayDelete(parent, name, false);
    if (err) {
        // POSIX says unlink should set EPERM, not EISDIR
        if (err === ERRNO_CODES.EISDIR) err = ERRNO_CODES.EPERM;
        throw new FS.ErrnoError(err);
    }
    if (!parent.node_ops.unlink) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
    }
    parent.node_ops.unlink(parent, name);
    FS.destroyNode(node);
},readlink:function (path) {
    var lookup = FS.lookupPath(path);
    var link = lookup.node;
    if (!link.node_ops.readlink) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    return link.node_ops.readlink(link);
},stat:function (path, dontFollow) {
    var lookup = FS.lookupPath(path, { follow: !dontFollow });
    var node = lookup.node;
    if (!node.node_ops.getattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    return node.node_ops.getattr(node);
},lstat:function (path) {
    return FS.stat(path, true);
},chmod:function (path, mode, dontFollow) {
    var node;
    if (typeof path === 'string') {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        node = lookup.node;
    } else {
        node = path;
    }
    if (!node.node_ops.setattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    node.node_ops.setattr(node, {
        mode: (mode & 4095) | (node.mode & ~4095),
        timestamp: Date.now()
    });
},lchmod:function (path, mode) {
    FS.chmod(path, mode, true);
},fchmod:function (fd, mode) {
    var stream = FS.getStream(fd);
    if (!stream) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    }
    FS.chmod(stream.node, mode);
},chown:function (path, uid, gid, dontFollow) {
    var node;
    if (typeof path === 'string') {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        node = lookup.node;
    } else {
        node = path;
    }
    if (!node.node_ops.setattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    node.node_ops.setattr(node, {
        timestamp: Date.now()
        // we ignore the uid / gid for now
    });
},lchown:function (path, uid, gid) {
    FS.chown(path, uid, gid, true);
},fchown:function (fd, uid, gid) {
    var stream = FS.getStream(fd);
    if (!stream) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    }
    FS.chown(stream.node, uid, gid);
},truncate:function (path, len) {
    if (len < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    var node;
    if (typeof path === 'string') {
        var lookup = FS.lookupPath(path, { follow: true });
        node = lookup.node;
    } else {
        node = path;
    }
    if (!node.node_ops.setattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    if (FS.isDir(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
    }
    if (!FS.isFile(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    var err = FS.nodePermissions(node, 'w');
    if (err) {
        throw new FS.ErrnoError(err);
    }
    node.node_ops.setattr(node, {
        size: len,
        timestamp: Date.now()
    });
},ftruncate:function (fd, len) {
    var stream = FS.getStream(fd);
    if (!stream) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    }
    if ((stream.flags & 2097155) === 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    FS.truncate(stream.node, len);
},utime:function (path, atime, mtime) {
    var lookup = FS.lookupPath(path, { follow: true });
    var node = lookup.node;
    node.node_ops.setattr(node, {
        timestamp: Math.max(atime, mtime)
    });
},open:function (path, flags, mode, fd_start, fd_end) {
    flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags;
    mode = typeof mode === 'undefined' ? 438 /* 0666 */ : mode;
    if ((flags & 64)) {
        mode = (mode & 4095) | 32768;
    } else {
        mode = 0;
    }
    var node;
    if (typeof path === 'object') {
        node = path;
    } else {
        path = PATH.normalize(path);
        try {
            var lookup = FS.lookupPath(path, {
                follow: !(flags & 131072)
            });
            node = lookup.node;
        } catch (e) {
            // ignore
        }
    }
    // perhaps we need to create the node
    if ((flags & 64)) {
        if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
                throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
            }
        } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
        }
    }
    if (!node) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
    }
    // can't truncate a device
    if (FS.isChrdev(node.mode)) {
        flags &= ~512;
    }
    // check permissions
    var err = FS.mayOpen(node, flags);
    if (err) {
        throw new FS.ErrnoError(err);
    }
    // do truncation if necessary
    if ((flags & 512)) {
        FS.truncate(node, 0);
    }
    // we've already handled these, don't pass down to the underlying vfs
    flags &= ~(128 | 512);

    // register the stream with the filesystem
    var stream = FS.createStream({
        node: node,
        path: FS.getPath(node),  // we want the absolute path to the node
        flags: flags,
        seekable: true,
        position: 0,
        stream_ops: node.stream_ops,
        // used by the file family libc calls (fopen, fwrite, ferror, etc.)
        ungotten: [],
        error: false
    }, fd_start, fd_end);
    // call the new stream's open function
    if (stream.stream_ops.open) {
        stream.stream_ops.open(stream);
    }
    if (Module['logReadFiles'] && !(flags & 1)) {
        if (!FS.readFiles) FS.readFiles = {};
        if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
            Module['printErr']('read file: ' + path);
        }
    }
    return stream;
},close:function (stream) {
    try {
        if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
        }
    } catch (e) {
        throw e;
    } finally {
        FS.closeStream(stream.fd);
    }
},llseek:function (stream, offset, whence) {
    if (!stream.seekable || !stream.stream_ops.llseek) {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
    }
    return stream.stream_ops.llseek(stream, offset, whence);
},read:function (stream, buffer, offset, length, position) {
    if (length < 0 || position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    if ((stream.flags & 2097155) === 1) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    }
    if (FS.isDir(stream.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
    }
    if (!stream.stream_ops.read) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    var seeking = true;
    if (typeof position === 'undefined') {
        position = stream.position;
        seeking = false;
    } else if (!stream.seekable) {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
    }
    var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
    if (!seeking) stream.position += bytesRead;
    return bytesRead;
},write:function (stream, buffer, offset, length, position, canOwn) {
    if (length < 0 || position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    if ((stream.flags & 2097155) === 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    }
    if (FS.isDir(stream.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
    }
    if (!stream.stream_ops.write) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    var seeking = true;
    if (typeof position === 'undefined') {
        position = stream.position;
        seeking = false;
    } else if (!stream.seekable) {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
    }
    if (stream.flags & 1024) {
        // seek to the end before writing in append mode
        FS.llseek(stream, 0, 2);
    }
    var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
    if (!seeking) stream.position += bytesWritten;
    return bytesWritten;
},allocate:function (stream, offset, length) {
    if (offset < 0 || length <= 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    if ((stream.flags & 2097155) === 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    }
    if (!FS.isFile(stream.node.mode) && !FS.isDir(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
    }
    if (!stream.stream_ops.allocate) {
        throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
    }
    stream.stream_ops.allocate(stream, offset, length);
},mmap:function (stream, buffer, offset, length, position, prot, flags) {
    // TODO if PROT is PROT_WRITE, make sure we have write access
    if ((stream.flags & 2097155) === 1) {
        throw new FS.ErrnoError(ERRNO_CODES.EACCES);
    }
    if (!stream.stream_ops.mmap) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
    }
    return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
},ioctl:function (stream, cmd, arg) {
    if (!stream.stream_ops.ioctl) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
    }
    return stream.stream_ops.ioctl(stream, cmd, arg);
},readFile:function (path, opts) {
    opts = opts || {};
    opts.flags = opts.flags || 'r';
    opts.encoding = opts.encoding || 'binary';
    if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
        throw new Error('Invalid encoding type "' + opts.encoding + '"');
    }
    var ret;
    var stream = FS.open(path, opts.flags);
    var stat = FS.stat(path);
    var length = stat.size;
    var buf = new Uint8Array(length);
    FS.read(stream, buf, 0, length, 0);
    if (opts.encoding === 'utf8') {
        ret = '';
        var utf8 = new Runtime.UTF8Processor();
        for (var i = 0; i < length; i++) {
            ret += utf8.processCChar(buf[i]);
        }
    } else if (opts.encoding === 'binary') {
        ret = buf;
    }
    FS.close(stream);
    return ret;
},writeFile:function (path, data, opts) {
    opts = opts || {};
    opts.flags = opts.flags || 'w';
    opts.encoding = opts.encoding || 'utf8';
    if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
        throw new Error('Invalid encoding type "' + opts.encoding + '"');
    }
    var stream = FS.open(path, opts.flags, opts.mode);
    if (opts.encoding === 'utf8') {
        var utf8 = new Runtime.UTF8Processor();
        var buf = new Uint8Array(utf8.processJSString(data));
        FS.write(stream, buf, 0, buf.length, 0, opts.canOwn);
    } else if (opts.encoding === 'binary') {
        FS.write(stream, data, 0, data.length, 0, opts.canOwn);
    }
    FS.close(stream);
},cwd:function () {
    return FS.currentPath;
},chdir:function (path) {
    var lookup = FS.lookupPath(path, { follow: true });
    if (!FS.isDir(lookup.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
    }
    var err = FS.nodePermissions(lookup.node, 'x');
    if (err) {
        throw new FS.ErrnoError(err);
    }
    FS.currentPath = lookup.path;
},createDefaultDirectories:function () {
    FS.mkdir('/tmp');
},createDefaultDevices:function () {
    // create /dev
    FS.mkdir('/dev');
    // setup /dev/null
    FS.registerDevice(FS.makedev(1, 3), {
        read: function() { return 0; },
        write: function() { return 0; }
    });
    FS.mkdev('/dev/null', FS.makedev(1, 3));
    // setup /dev/tty and /dev/tty1
    // stderr needs to print output using Module['printErr']
    // so we register a second tty just for it.
    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
    FS.mkdev('/dev/tty', FS.makedev(5, 0));
    FS.mkdev('/dev/tty1', FS.makedev(6, 0));
    // we're not going to emulate the actual shm device,
    // just create the tmp dirs that reside in it commonly
    FS.mkdir('/dev/shm');
    FS.mkdir('/dev/shm/tmp');
},createStandardStreams:function () {
    // TODO deprecate the old functionality of a single
    // input / output callback and that utilizes FS.createDevice
    // and instead require a unique set of stream ops

    // by default, we symlink the standard streams to the
    // default tty devices. however, if the standard streams
    // have been overwritten we create a unique device for
    // them instead.
    if (Module['stdin']) {
        FS.createDevice('/dev', 'stdin', Module['stdin']);
    } else {
        FS.symlink('/dev/tty', '/dev/stdin');
    }
    if (Module['stdout']) {
        FS.createDevice('/dev', 'stdout', null, Module['stdout']);
    } else {
        FS.symlink('/dev/tty', '/dev/stdout');
    }
    if (Module['stderr']) {
        FS.createDevice('/dev', 'stderr', null, Module['stderr']);
    } else {
        FS.symlink('/dev/tty1', '/dev/stderr');
    }

    // open default streams for the stdin, stdout and stderr devices
    var stdin = FS.open('/dev/stdin', 'r');
    HEAP32[((_stdin)>>2)]=FS.getPtrForStream(stdin);
    assert(stdin.fd === 0, 'invalid handle for stdin (' + stdin.fd + ')');

    var stdout = FS.open('/dev/stdout', 'w');
    HEAP32[((_stdout)>>2)]=FS.getPtrForStream(stdout);
    assert(stdout.fd === 1, 'invalid handle for stdout (' + stdout.fd + ')');

    var stderr = FS.open('/dev/stderr', 'w');
    HEAP32[((_stderr)>>2)]=FS.getPtrForStream(stderr);
    assert(stderr.fd === 2, 'invalid handle for stderr (' + stderr.fd + ')');
},ensureErrnoError:function () {
    if (FS.ErrnoError) return;
    FS.ErrnoError = function ErrnoError(errno) {
        this.errno = errno;
        for (var key in ERRNO_CODES) {
            if (ERRNO_CODES[key] === errno) {
                this.code = key;
                break;
            }
        }
        this.message = ERRNO_MESSAGES[errno];
    };
    FS.ErrnoError.prototype = new Error();
    FS.ErrnoError.prototype.constructor = FS.ErrnoError;
    // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
    [ERRNO_CODES.ENOENT].forEach(function(code) {
        FS.genericErrors[code] = new FS.ErrnoError(code);
        FS.genericErrors[code].stack = '<generic error, no stack>';
    });
},staticInit:function () {
    FS.ensureErrnoError();

    FS.nameTable = new Array(4096);

    FS.mount(MEMFS, {}, '/');

    FS.createDefaultDirectories();
    FS.createDefaultDevices();
},init:function (input, output, error) {
    assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
    FS.init.initialized = true;

    FS.ensureErrnoError();

    // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
    Module['stdin'] = input || Module['stdin'];
    Module['stdout'] = output || Module['stdout'];
    Module['stderr'] = error || Module['stderr'];

    FS.createStandardStreams();
},quit:function () {
    FS.init.initialized = false;
    for (var i = 0; i < FS.streams.length; i++) {
        var stream = FS.streams[i];
        if (!stream) {
            continue;
        }
        FS.close(stream);
    }
},getMode:function (canRead, canWrite) {
    var mode = 0;
    if (canRead) mode |= 292 | 73;
    if (canWrite) mode |= 146;
    return mode;
},joinPath:function (parts, forceRelative) {
    var path = PATH.join.apply(null, parts);
    if (forceRelative && path[0] == '/') path = path.substr(1);
    return path;
},absolutePath:function (relative, base) {
    return PATH.resolve(base, relative);
},standardizePath:function (path) {
    return PATH.normalize(path);
},findObject:function (path, dontResolveLastLink) {
    var ret = FS.analyzePath(path, dontResolveLastLink);
    if (ret.exists) {
        return ret.object;
    } else {
        ___setErrNo(ret.error);
        return null;
    }
},analyzePath:function (path, dontResolveLastLink) {
    // operate from within the context of the symlink's target
    try {
        var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
        path = lookup.path;
    } catch (e) {
    }
    var ret = {
        isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
        parentExists: false, parentPath: null, parentObject: null
    };
    try {
        var lookup = FS.lookupPath(path, { parent: true });
        ret.parentExists = true;
        ret.parentPath = lookup.path;
        ret.parentObject = lookup.node;
        ret.name = PATH.basename(path);
        lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
        ret.exists = true;
        ret.path = lookup.path;
        ret.object = lookup.node;
        ret.name = lookup.node.name;
        ret.isRoot = lookup.path === '/';
    } catch (e) {
        ret.error = e.errno;
    };
    return ret;
},createFolder:function (parent, name, canRead, canWrite) {
    var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
    var mode = FS.getMode(canRead, canWrite);
    return FS.mkdir(path, mode);
},createPath:function (parent, path, canRead, canWrite) {
    parent = typeof parent === 'string' ? parent : FS.getPath(parent);
    var parts = path.split('/').reverse();
    while (parts.length) {
        var part = parts.pop();
        if (!part) continue;
        var current = PATH.join2(parent, part);
        try {
            FS.mkdir(current);
        } catch (e) {
            // ignore EEXIST
        }
        parent = current;
    }
    return current;
},createFile:function (parent, name, properties, canRead, canWrite) {
    var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
    var mode = FS.getMode(canRead, canWrite);
    return FS.create(path, mode);
},createDataFile:function (parent, name, data, canRead, canWrite, canOwn) {
    var path = name ? PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name) : parent;
    var mode = FS.getMode(canRead, canWrite);
    var node = FS.create(path, mode);
    if (data) {
        if (typeof data === 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
        }
        // make sure we can write to the file
        FS.chmod(node, mode | 146);
        var stream = FS.open(node, 'w');
        FS.write(stream, data, 0, data.length, 0, canOwn);
        FS.close(stream);
        FS.chmod(node, mode);
    }
    return node;
},createDevice:function (parent, name, input, output) {
    var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
    var mode = FS.getMode(!!input, !!output);
    if (!FS.createDevice.major) FS.createDevice.major = 64;
    var dev = FS.makedev(FS.createDevice.major++, 0);
    // Create a fake device that a set of stream ops to emulate
    // the old behavior.
    FS.registerDevice(dev, {
        open: function(stream) {
            stream.seekable = false;
        },
        close: function(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
                output(10);
            }
        },
        read: function(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
                var result;
                try {
                    result = input();
                } catch (e) {
                    throw new FS.ErrnoError(ERRNO_CODES.EIO);
                }
                if (result === undefined && bytesRead === 0) {
                    throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
                }
                if (result === null || result === undefined) break;
                bytesRead++;
                buffer[offset+i] = result;
            }
            if (bytesRead) {
                stream.node.timestamp = Date.now();
            }
            return bytesRead;
        },
        write: function(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
                try {
                    output(buffer[offset+i]);
                } catch (e) {
                    throw new FS.ErrnoError(ERRNO_CODES.EIO);
                }
            }
            if (length) {
                stream.node.timestamp = Date.now();
            }
            return i;
        }
    });
    return FS.mkdev(path, mode, dev);
},createLink:function (parent, name, target, canRead, canWrite) {
    var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
    return FS.symlink(target, path);
},forceLoadFile:function (obj) {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
    var success = true;
    if (typeof XMLHttpRequest !== 'undefined') {
        throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
    } else if (Module['read']) {
        // Command-line.
        try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(Module['read'](obj.url), true);
        } catch (e) {
            success = false;
        }
    } else {
        throw new Error('Cannot load without read() or XMLHttpRequest.');
    }
    if (!success) ___setErrNo(ERRNO_CODES.EIO);
    return success;
},createLazyFile:function (parent, name, url, canRead, canWrite) {
    if (typeof XMLHttpRequest !== 'undefined') {
        if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
        // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
        function LazyUint8Array() {
            this.lengthKnown = false;
            this.chunks = []; // Loaded chunks. Index is the chunk number
        }
        LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
            if (idx > this.length-1 || idx < 0) {
                return undefined;
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = Math.floor(idx / this.chunkSize);
            return this.getter(chunkNum)[chunkOffset];
        }
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
            this.getter = getter;
        }
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
            // Find length
            var xhr = new XMLHttpRequest();
            xhr.open('HEAD', url, false);
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            var datalength = Number(xhr.getResponseHeader("Content-length"));
            var header;
            var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
            var chunkSize = 1024*1024; // Chunk size in bytes

            if (!hasByteServing) chunkSize = datalength;

            // Function to get a range from the remote URL.
            var doXHR = (function(from, to) {
                if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
                if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");

                // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, false);
                if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);

                // Some hints to the browser that we want binary data.
                if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
                if (xhr.overrideMimeType) {
                    xhr.overrideMimeType('text/plain; charset=x-user-defined');
                }

                xhr.send(null);
                if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
                if (xhr.response !== undefined) {
                    return new Uint8Array(xhr.response || []);
                } else {
                    return intArrayFromString(xhr.responseText || '', true);
                }
            });
            var lazyArray = this;
            lazyArray.setDataGetter(function(chunkNum) {
                var start = chunkNum * chunkSize;
                var end = (chunkNum+1) * chunkSize - 1; // including this byte
                end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
                if (typeof(lazyArray.chunks[chunkNum]) === "undefined") {
                    lazyArray.chunks[chunkNum] = doXHR(start, end);
                }
                if (typeof(lazyArray.chunks[chunkNum]) === "undefined") throw new Error("doXHR failed!");
                return lazyArray.chunks[chunkNum];
            });

            this._length = datalength;
            this._chunkSize = chunkSize;
            this.lengthKnown = true;
        }

        var lazyArray = new LazyUint8Array();
        Object.defineProperty(lazyArray, "length", {
            get: function() {
                if(!this.lengthKnown) {
                    this.cacheLength();
                }
                return this._length;
            }
        });
        Object.defineProperty(lazyArray, "chunkSize", {
            get: function() {
                if(!this.lengthKnown) {
                    this.cacheLength();
                }
                return this._chunkSize;
            }
        });

        var properties = { isDevice: false, contents: lazyArray };
    } else {
        var properties = { isDevice: false, url: url };
    }

    var node = FS.createFile(parent, name, properties, canRead, canWrite);
    // This is a total hack, but I want to get this lazy file code out of the
    // core of MEMFS. If we want to keep this lazy file concept I feel it should
    // be its own thin LAZYFS proxying calls to MEMFS.
    if (properties.contents) {
        node.contents = properties.contents;
    } else if (properties.url) {
        node.contents = null;
        node.url = properties.url;
    }
    // override each stream op with one that tries to force load the lazy file first
    var stream_ops = {};
    var keys = Object.keys(node.stream_ops);
    keys.forEach(function(key) {
        var fn = node.stream_ops[key];
        stream_ops[key] = function forceLoadLazyFile() {
            if (!FS.forceLoadFile(node)) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            return fn.apply(null, arguments);
        };
    });
    // use a custom read function
    stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
        if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
        }
        var contents = stream.node.contents;
        if (position >= contents.length)
            return 0;
        var size = Math.min(contents.length - position, length);
        assert(size >= 0);
        if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
                buffer[offset + i] = contents[position + i];
            }
        } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
                buffer[offset + i] = contents.get(position + i);
            }
        }
        return size;
    };
    node.stream_ops = stream_ops;
    return node;
},createPreloadedFile:function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn) {
    Browser.init();
    // TODO we should allow people to just pass in a complete filename instead
    // of parent and name being that we just join them anyways
    var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
    function processData(byteArray) {
        function finish(byteArray) {
            if (!dontCreateFile) {
                FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
            }
            if (onload) onload();
            removeRunDependency('cp ' + fullname);
        }
        var handled = false;
        Module['preloadPlugins'].forEach(function(plugin) {
            if (handled) return;
            if (plugin['canHandle'](fullname)) {
                plugin['handle'](byteArray, fullname, finish, function() {
                    if (onerror) onerror();
                    removeRunDependency('cp ' + fullname);
                });
                handled = true;
            }
        });
        if (!handled) finish(byteArray);
    }
    addRunDependency('cp ' + fullname);
    if (typeof url == 'string') {
        Browser.asyncLoad(url, function(byteArray) {
            processData(byteArray);
        }, onerror);
    } else {
        processData(url);
    }
},indexedDB:function () {
    return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
},DB_NAME:function () {
    return 'EM_FS_' + window.location.pathname;
},DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:function (paths, onload, onerror) {
    onload = onload || function(){};
    onerror = onerror || function(){};
    var indexedDB = FS.indexedDB();
    try {
        var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
    } catch (e) {
        return onerror(e);
    }
    openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
        console.log('creating db');
        var db = openRequest.result;
        db.createObjectStore(FS.DB_STORE_NAME);
    };
    openRequest.onsuccess = function openRequest_onsuccess() {
        var db = openRequest.result;
        var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
        var files = transaction.objectStore(FS.DB_STORE_NAME);
        var ok = 0, fail = 0, total = paths.length;
        function finish() {
            if (fail == 0) onload(); else onerror();
        }
        paths.forEach(function(path) {
            var putRequest = files.put(FS.analyzePath(path).object.contents, path);
            putRequest.onsuccess = function putRequest_onsuccess() { ok++; if (ok + fail == total) finish() };
            putRequest.onerror = function putRequest_onerror() { fail++; if (ok + fail == total) finish() };
        });
        transaction.onerror = onerror;
    };
    openRequest.onerror = onerror;
},loadFilesFromDB:function (paths, onload, onerror) {
    onload = onload || function(){};
    onerror = onerror || function(){};
    var indexedDB = FS.indexedDB();
    try {
        var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
    } catch (e) {
        return onerror(e);
    }
    openRequest.onupgradeneeded = onerror; // no database to load from
    openRequest.onsuccess = function openRequest_onsuccess() {
        var db = openRequest.result;
        try {
            var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
        } catch(e) {
            onerror(e);
            return;
        }
        var files = transaction.objectStore(FS.DB_STORE_NAME);
        var ok = 0, fail = 0, total = paths.length;
        function finish() {
            if (fail == 0) onload(); else onerror();
        }
        paths.forEach(function(path) {
            var getRequest = files.get(path);
            getRequest.onsuccess = function getRequest_onsuccess() {
                if (FS.analyzePath(path).exists) {
                    FS.unlink(path);
                }
                FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
                ok++;
                if (ok + fail == total) finish();
            };
            getRequest.onerror = function getRequest_onerror() { fail++; if (ok + fail == total) finish() };
        });
        transaction.onerror = onerror;
    };
    openRequest.onerror = onerror;
}};var PATH={splitPath:function (filename) {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1);
},normalizeArray:function (parts, allowAboveRoot) {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
        var last = parts[i];
        if (last === '.') {
            parts.splice(i, 1);
        } else if (last === '..') {
            parts.splice(i, 1);
            up++;
        } else if (up) {
            parts.splice(i, 1);
            up--;
        }
    }
    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
        for (; up--; up) {
            parts.unshift('..');
        }
    }
    return parts;
},normalize:function (path) {
    var isAbsolute = path.charAt(0) === '/',
        trailingSlash = path.substr(-1) === '/';
    // Normalize the path
    path = PATH.normalizeArray(path.split('/').filter(function(p) {
        return !!p;
    }), !isAbsolute).join('/');
    if (!path && !isAbsolute) {
        path = '.';
    }
    if (path && trailingSlash) {
        path += '/';
    }
    return (isAbsolute ? '/' : '') + path;
},dirname:function (path) {
    var result = PATH.splitPath(path),
        root = result[0],
        dir = result[1];
    if (!root && !dir) {
        // No dirname whatsoever
        return '.';
    }
    if (dir) {
        // It has a dirname, strip trailing slash
        dir = dir.substr(0, dir.length - 1);
    }
    return root + dir;
},basename:function (path) {
    // EMSCRIPTEN return '/'' for '/', not an empty string
    if (path === '/') return '/';
    var lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) return path;
    return path.substr(lastSlash+1);
},extname:function (path) {
    return PATH.splitPath(path)[3];
},join:function () {
    var paths = Array.prototype.slice.call(arguments, 0);
    return PATH.normalize(paths.join('/'));
},join2:function (l, r) {
    return PATH.normalize(l + '/' + r);
},resolve:function () {
    var resolvedPath = '',
        resolvedAbsolute = false;
    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        var path = (i >= 0) ? arguments[i] : FS.cwd();
        // Skip empty and invalid entries
        if (typeof path !== 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
        } else if (!path) {
            continue;
        }
        resolvedPath = path + '/' + resolvedPath;
        resolvedAbsolute = path.charAt(0) === '/';
    }
    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)
    resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter(function(p) {
        return !!p;
    }), !resolvedAbsolute).join('/');
    return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
},relative:function (from, to) {
    from = PATH.resolve(from).substr(1);
    to = PATH.resolve(to).substr(1);
    function trim(arr) {
        var start = 0;
        for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
        }
        var end = arr.length - 1;
        for (; end >= 0; end--) {
            if (arr[end] !== '') break;
        }
        if (start > end) return [];
        return arr.slice(start, end - start + 1);
    }
    var fromParts = trim(from.split('/'));
    var toParts = trim(to.split('/'));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
        if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
        }
    }
    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
        outputParts.push('..');
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join('/');
}};var Browser={mainLoop:{scheduler:null,method:"",shouldPause:false,paused:false,queue:[],pause:function () {
    Browser.mainLoop.shouldPause = true;
},resume:function () {
    if (Browser.mainLoop.paused) {
        Browser.mainLoop.paused = false;
        Browser.mainLoop.scheduler();
    }
    Browser.mainLoop.shouldPause = false;
},updateStatus:function () {
    if (Module['setStatus']) {
        var message = Module['statusMessage'] || 'Please wait...';
        var remaining = Browser.mainLoop.remainingBlockers;
        var expected = Browser.mainLoop.expectedBlockers;
        if (remaining) {
            if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
            } else {
                Module['setStatus'](message);
            }
        } else {
            Module['setStatus']('');
        }
    }
}},isFullScreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function () {
    if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers

    if (Browser.initted || ENVIRONMENT_IS_WORKER) return;
    Browser.initted = true;

    try {
        new Blob();
        Browser.hasBlobConstructor = true;
    } catch(e) {
        Browser.hasBlobConstructor = false;
        console.log("warning: no blob constructor, cannot create blobs with mimetypes");
    }
    Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
    Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
    if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
        console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
        Module.noImageDecoding = true;
    }

    // Support for plugins that can process preloaded files. You can add more of these to
    // your app by creating and appending to Module.preloadPlugins.
    //
    // Each plugin is asked if it can handle a file based on the file's name. If it can,
    // it is given the file's raw data. When it is done, it calls a callback with the file's
    // (possibly modified) data. For example, a plugin might decompress a file, or it
    // might create some side data structure for use later (like an Image element, etc.).

    var imagePlugin = {};
    imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
        return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
    };
    imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
        var b = null;
        if (Browser.hasBlobConstructor) {
            try {
                b = new Blob([byteArray], { type: Browser.getMimetype(name) });
                if (b.size !== byteArray.length) { // Safari bug #118630
                    // Safari's Blob can only take an ArrayBuffer
                    b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
                }
            } catch(e) {
                Runtime.warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
        }
        if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
        }
        var url = Browser.URLObject.createObjectURL(b);
        var img = new Image();
        img.onload = function img_onload() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
        };
        img.onerror = function img_onerror(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
        };
        img.src = url;
    };
    Module['preloadPlugins'].push(imagePlugin);

    var audioPlugin = {};
    audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
        return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
    };
    audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
        var done = false;
        function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
        }
        function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
        }
        if (Browser.hasBlobConstructor) {
            try {
                var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            } catch(e) {
                return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
                if (done) return;
                console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
                function encode64(data) {
                    var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                    var PAD = '=';
                    var ret = '';
                    var leftchar = 0;
                    var leftbits = 0;
                    for (var i = 0; i < data.length; i++) {
                        leftchar = (leftchar << 8) | data[i];
                        leftbits += 8;
                        while (leftbits >= 6) {
                            var curr = (leftchar >> (leftbits-6)) & 0x3f;
                            leftbits -= 6;
                            ret += BASE[curr];
                        }
                    }
                    if (leftbits == 2) {
                        ret += BASE[(leftchar&3) << 4];
                        ret += PAD + PAD;
                    } else if (leftbits == 4) {
                        ret += BASE[(leftchar&0xf) << 2];
                        ret += PAD;
                    }
                    return ret;
                }
                audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
                finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
                finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
        } else {
            return fail();
        }
    };
    Module['preloadPlugins'].push(audioPlugin);

    // Canvas event setup

    var canvas = Module['canvas'];

    // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
    // Module['forcedAspectRatio'] = 4 / 3;

    canvas.requestPointerLock = canvas['requestPointerLock'] ||
        canvas['mozRequestPointerLock'] ||
        canvas['webkitRequestPointerLock'] ||
        canvas['msRequestPointerLock'] ||
        function(){};
    canvas.exitPointerLock = document['exitPointerLock'] ||
        document['mozExitPointerLock'] ||
        document['webkitExitPointerLock'] ||
        document['msExitPointerLock'] ||
        function(){}; // no-op if function does not exist
    canvas.exitPointerLock = canvas.exitPointerLock.bind(document);

    function pointerLockChange() {
        Browser.pointerLock = document['pointerLockElement'] === canvas ||
            document['mozPointerLockElement'] === canvas ||
            document['webkitPointerLockElement'] === canvas ||
            document['msPointerLockElement'] === canvas;
    }

    document.addEventListener('pointerlockchange', pointerLockChange, false);
    document.addEventListener('mozpointerlockchange', pointerLockChange, false);
    document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
    document.addEventListener('mspointerlockchange', pointerLockChange, false);

    if (Module['elementPointerLock']) {
        canvas.addEventListener("click", function(ev) {
            if (!Browser.pointerLock && canvas.requestPointerLock) {
                canvas.requestPointerLock();
                ev.preventDefault();
            }
        }, false);
    }
},createContext:function (canvas, useWebGL, setInModule, webGLContextAttributes) {
    var ctx;
    var errorInfo = '?';
    function onContextCreationError(event) {
        errorInfo = event.statusMessage || errorInfo;
    }
    try {
        if (useWebGL) {
            var contextAttributes = {
                antialias: false,
                alpha: false
            };

            if (webGLContextAttributes) {
                for (var attribute in webGLContextAttributes) {
                    contextAttributes[attribute] = webGLContextAttributes[attribute];
                }
            }


            canvas.addEventListener('webglcontextcreationerror', onContextCreationError, false);
            try {
                ['experimental-webgl', 'webgl'].some(function(webglId) {
                    return ctx = canvas.getContext(webglId, contextAttributes);
                });
            } finally {
                canvas.removeEventListener('webglcontextcreationerror', onContextCreationError, false);
            }
        } else {
            ctx = canvas.getContext('2d');
        }
        if (!ctx) throw ':(';
    } catch (e) {
        Module.print('Could not create canvas: ' + [errorInfo, e]);
        return null;
    }
    if (useWebGL) {
        // Set the background of the WebGL canvas to black
        canvas.style.backgroundColor = "black";

        // Warn on context loss
        canvas.addEventListener('webglcontextlost', function(event) {
            alert('WebGL context lost. You will need to reload the page.');
        }, false);
    }
    if (setInModule) {
        GLctx = Module.ctx = ctx;
        Module.useWebGL = useWebGL;
        Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
        Browser.init();
    }
    return ctx;
},destroyContext:function (canvas, useWebGL, setInModule) {},fullScreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullScreen:function (lockPointer, resizeCanvas) {
    Browser.lockPointer = lockPointer;
    Browser.resizeCanvas = resizeCanvas;
    if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
    if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;

    var canvas = Module['canvas'];
    var canvasContainer = canvas.parentNode;
    function fullScreenChange() {
        Browser.isFullScreen = false;
        if ((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
            document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
            document['fullScreenElement'] || document['fullscreenElement'] ||
            document['msFullScreenElement'] || document['msFullscreenElement'] ||
            document['webkitCurrentFullScreenElement']) === canvasContainer) {
            canvas.cancelFullScreen = document['cancelFullScreen'] ||
                document['mozCancelFullScreen'] ||
                document['webkitCancelFullScreen'] ||
                document['msExitFullscreen'] ||
                document['exitFullscreen'] ||
                function() {};
            canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullScreen = true;
            if (Browser.resizeCanvas) Browser.setFullScreenCanvasSize();
        } else {

            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            var canvasContainer = canvas.parentNode;
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);

            if (Browser.resizeCanvas) Browser.setWindowedCanvasSize();
        }
        if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullScreen);
        Browser.updateCanvasDimensions(canvas);
    }

    if (!Browser.fullScreenHandlersInstalled) {
        Browser.fullScreenHandlersInstalled = true;
        document.addEventListener('fullscreenchange', fullScreenChange, false);
        document.addEventListener('mozfullscreenchange', fullScreenChange, false);
        document.addEventListener('webkitfullscreenchange', fullScreenChange, false);
        document.addEventListener('MSFullscreenChange', fullScreenChange, false);
    }

    // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
    var canvasContainer = document.createElement("div");
    canvas.parentNode.insertBefore(canvasContainer, canvas);
    canvasContainer.appendChild(canvas);

    // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
    canvasContainer.requestFullScreen = canvasContainer['requestFullScreen'] ||
        canvasContainer['mozRequestFullScreen'] ||
        canvasContainer['msRequestFullscreen'] ||
        (canvasContainer['webkitRequestFullScreen'] ? function() { canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
    canvasContainer.requestFullScreen();
},requestAnimationFrame:function requestAnimationFrame(func) {
    if (typeof window === 'undefined') { // Provide fallback to setTimeout if window is undefined (e.g. in Node.js)
        setTimeout(func, 1000/60);
    } else {
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window['requestAnimationFrame'] ||
                window['mozRequestAnimationFrame'] ||
                window['webkitRequestAnimationFrame'] ||
                window['msRequestAnimationFrame'] ||
                window['oRequestAnimationFrame'] ||
                window['setTimeout'];
        }
        window.requestAnimationFrame(func);
    }
},safeCallback:function (func) {
    return function() {
        if (!ABORT) return func.apply(null, arguments);
    };
},safeRequestAnimationFrame:function (func) {
    return Browser.requestAnimationFrame(function() {
        if (!ABORT) func();
    });
},safeSetTimeout:function (func, timeout) {
    return setTimeout(function() {
        if (!ABORT) func();
    }, timeout);
},safeSetInterval:function (func, timeout) {
    return setInterval(function() {
        if (!ABORT) func();
    }, timeout);
},getMimetype:function (name) {
    return {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'bmp': 'image/bmp',
        'ogg': 'audio/ogg',
        'wav': 'audio/wav',
        'mp3': 'audio/mpeg'
    }[name.substr(name.lastIndexOf('.')+1)];
},getUserMedia:function (func) {
    if(!window.getUserMedia) {
        window.getUserMedia = navigator['getUserMedia'] ||
            navigator['mozGetUserMedia'];
    }
    window.getUserMedia(func);
},getMovementX:function (event) {
    return event['movementX'] ||
        event['mozMovementX'] ||
        event['webkitMovementX'] ||
        0;
},getMovementY:function (event) {
    return event['movementY'] ||
        event['mozMovementY'] ||
        event['webkitMovementY'] ||
        0;
},getMouseWheelDelta:function (event) {
    return Math.max(-1, Math.min(1, event.type === 'DOMMouseScroll' ? event.detail : -event.wheelDelta));
},mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,calculateMouseEvent:function (event) { // event should be mousemove, mousedown or mouseup
    if (Browser.pointerLock) {
        // When the pointer is locked, calculate the coordinates
        // based on the movement of the mouse.
        // Workaround for Firefox bug 764498
        if (event.type != 'mousemove' &&
            ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
        } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
        }

        // check if SDL is available
        if (typeof SDL != "undefined") {
            Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
            Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
        } else {
            // just add the mouse delta to the current absolut mouse position
            // FIXME: ideally this should be clamped against the canvas size and zero
            Browser.mouseX += Browser.mouseMovementX;
            Browser.mouseY += Browser.mouseMovementY;
        }
    } else {
        // Otherwise, calculate the movement based on the changes
        // in the coordinates.
        var rect = Module["canvas"].getBoundingClientRect();
        var x, y;

        // Neither .scrollX or .pageXOffset are defined in a spec, but
        // we prefer .scrollX because it is currently in a spec draft.
        // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
        var scrollX = ((typeof window.scrollX !== 'undefined') ? window.scrollX : window.pageXOffset);
        var scrollY = ((typeof window.scrollY !== 'undefined') ? window.scrollY : window.pageYOffset);
        if (event.type == 'touchstart' ||
            event.type == 'touchend' ||
            event.type == 'touchmove') {
            var t = event.touches.item(0);
            if (t) {
                x = t.pageX - (scrollX + rect.left);
                y = t.pageY - (scrollY + rect.top);
            } else {
                return;
            }
        } else {
            x = event.pageX - (scrollX + rect.left);
            y = event.pageY - (scrollY + rect.top);
        }

        // the canvas might be CSS-scaled compared to its backbuffer;
        // SDL-using content will want mouse coordinates in terms
        // of backbuffer units.
        var cw = Module["canvas"].width;
        var ch = Module["canvas"].height;
        x = x * (cw / rect.width);
        y = y * (ch / rect.height);

        Browser.mouseMovementX = x - Browser.mouseX;
        Browser.mouseMovementY = y - Browser.mouseY;
        Browser.mouseX = x;
        Browser.mouseY = y;
    }
},xhrLoad:function (url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
        if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
            onload(xhr.response);
        } else {
            onerror();
        }
    };
    xhr.onerror = onerror;
    xhr.send(null);
},asyncLoad:function (url, onload, onerror, noRunDep) {
    Browser.xhrLoad(url, function(arrayBuffer) {
        assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
        onload(new Uint8Array(arrayBuffer));
        if (!noRunDep) removeRunDependency('al ' + url);
    }, function(event) {
        if (onerror) {
            onerror();
        } else {
            throw 'Loading data file "' + url + '" failed.';
        }
    });
    if (!noRunDep) addRunDependency('al ' + url);
},resizeListeners:[],updateResizeListeners:function () {
    var canvas = Module['canvas'];
    Browser.resizeListeners.forEach(function(listener) {
        listener(canvas.width, canvas.height);
    });
},setCanvasSize:function (width, height, noUpdates) {
    var canvas = Module['canvas'];
    Browser.updateCanvasDimensions(canvas, width, height);
    if (!noUpdates) Browser.updateResizeListeners();
},windowedWidth:0,windowedHeight:0,setFullScreenCanvasSize:function () {
    // check if SDL is available   
    if (typeof SDL != "undefined") {
        var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
        HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
    }
    Browser.updateResizeListeners();
},setWindowedCanvasSize:function () {
    // check if SDL is available       
    if (typeof SDL != "undefined") {
        var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
        HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
    }
    Browser.updateResizeListeners();
},updateCanvasDimensions:function (canvas, wNative, hNative) {
    if (wNative && hNative) {
        canvas.widthNative = wNative;
        canvas.heightNative = hNative;
    } else {
        wNative = canvas.widthNative;
        hNative = canvas.heightNative;
    }
    var w = wNative;
    var h = hNative;
    if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
        if (w/h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio']);
        } else {
            h = Math.round(w / Module['forcedAspectRatio']);
        }
    }
    if (((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
        document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
        document['fullScreenElement'] || document['fullscreenElement'] ||
        document['msFullScreenElement'] || document['msFullscreenElement'] ||
        document['webkitCurrentFullScreenElement']) === canvas.parentNode) && (typeof screen != 'undefined')) {
        var factor = Math.min(screen.width / w, screen.height / h);
        w = Math.round(w * factor);
        h = Math.round(h * factor);
    }
    if (Browser.resizeCanvas) {
        if (canvas.width  != w) canvas.width  = w;
        if (canvas.height != h) canvas.height = h;
        if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty( "width");
            canvas.style.removeProperty("height");
        }
    } else {
        if (canvas.width  != wNative) canvas.width  = wNative;
        if (canvas.height != hNative) canvas.height = hNative;
        if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
                canvas.style.setProperty( "width", w + "px", "important");
                canvas.style.setProperty("height", h + "px", "important");
            } else {
                canvas.style.removeProperty( "width");
                canvas.style.removeProperty("height");
            }
        }
    }
}};

function _time(ptr) {
    var ret = Math.floor(Date.now()/1000);
    if (ptr) {
        HEAP32[((ptr)>>2)]=ret;
    }
    return ret;
}

var _llvm_memset_p0i8_i32=_memset;
___errno_state = Runtime.staticAlloc(4); HEAP32[((___errno_state)>>2)]=0;
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas) { Browser.requestFullScreen(lockPointer, resizeCanvas) };
Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
FS.staticInit();__ATINIT__.unshift({ func: function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() } });__ATMAIN__.push({ func: function() { FS.ignorePermissions = false } });__ATEXIT__.push({ func: function() { FS.quit() } });Module["FS_createFolder"] = FS.createFolder;Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPreloadedFile"] = FS.createPreloadedFile;Module["FS_createLazyFile"] = FS.createLazyFile;Module["FS_createLink"] = FS.createLink;Module["FS_createDevice"] = FS.createDevice;
__ATINIT__.unshift({ func: function() { TTY.init() } });__ATEXIT__.push({ func: function() { TTY.shutdown() } });TTY.utf8 = new Runtime.UTF8Processor();
if (ENVIRONMENT_IS_NODE) { var fs = require("fs"); NODEFS.staticInit(); }
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + 5242880;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

var ctlz_i8 = allocate([8,7,6,6,5,5,5,5,4,4,4,4,4,4,4,4,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], "i8", ALLOC_DYNAMIC);
var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_DYNAMIC);

var Math_min = Math.min;
function asmPrintInt(x, y) {
    Module.print('int ' + x + ',' + y);// + ' ' + new Error().stack);
}
function asmPrintFloat(x, y) {
    Module.print('float ' + x + ',' + y);// + ' ' + new Error().stack);
}
// EMSCRIPTEN_START_ASM
var asm=(function(global,env,buffer){"use asm";var a=new global.Int8Array(buffer);var b=new global.Int16Array(buffer);var c=new global.Int32Array(buffer);var d=new global.Uint8Array(buffer);var e=new global.Uint16Array(buffer);var f=new global.Uint32Array(buffer);var g=new global.Float32Array(buffer);var h=new global.Float64Array(buffer);var i=env.STACKTOP|0;var j=env.STACK_MAX|0;var k=env.tempDoublePtr|0;var l=env.ABORT|0;var m=env.cttz_i8|0;var n=env.ctlz_i8|0;var o=0;var p=0;var q=0;var r=0;var s=+env.NaN,t=+env.Infinity;var u=0,v=0,w=0,x=0,y=0.0,z=0,A=0,B=0,C=0.0;var D=0;var E=0;var F=0;var G=0;var H=0;var I=0;var J=0;var K=0;var L=0;var M=0;var N=global.Math.floor;var O=global.Math.abs;var P=global.Math.sqrt;var Q=global.Math.pow;var R=global.Math.cos;var S=global.Math.sin;var T=global.Math.tan;var U=global.Math.acos;var V=global.Math.asin;var W=global.Math.atan;var X=global.Math.atan2;var Y=global.Math.exp;var Z=global.Math.log;var _=global.Math.ceil;var $=global.Math.imul;var aa=env.abort;var ba=env.assert;var ca=env.asmPrintInt;var da=env.asmPrintFloat;var ea=env.min;var fa=env._fflush;var ga=env._abort;var ha=env.___setErrNo;var ia=env._sbrk;var ja=env._time;var ka=env._emscripten_memcpy_big;var la=env._sysconf;var ma=env.___errno_location;var na=0.0;
// EMSCRIPTEN_START_FUNCS
    function oa(a){a=a|0;var b=0;b=i;i=i+a|0;i=i+7&-8;return b|0}function pa(){return i|0}function qa(a){a=a|0;i=a}function ra(a,b){a=a|0;b=b|0;if((o|0)==0){o=a;p=b}}function sa(b){b=b|0;a[k]=a[b];a[k+1|0]=a[b+1|0];a[k+2|0]=a[b+2|0];a[k+3|0]=a[b+3|0]}function ta(b){b=b|0;a[k]=a[b];a[k+1|0]=a[b+1|0];a[k+2|0]=a[b+2|0];a[k+3|0]=a[b+3|0];a[k+4|0]=a[b+4|0];a[k+5|0]=a[b+5|0];a[k+6|0]=a[b+6|0];a[k+7|0]=a[b+7|0]}function ua(a){a=a|0;D=a}function va(a){a=a|0;E=a}function wa(a){a=a|0;F=a}function xa(a){a=a|0;G=a}function ya(a){a=a|0;H=a}function za(a){a=a|0;I=a}function Aa(a){a=a|0;J=a}function Ba(a){a=a|0;K=a}function Ca(a){a=a|0;L=a}function Da(a){a=a|0;M=a}function Ea(a){a=a|0;var b=0,c=0,d=0,e=0;b=i;i=i+16|0;c=a;do{if((c<<24>>24|0)>=48){if((c<<24>>24|0)>57){break}d=(c<<24>>24)-48&255;e=d;i=b;return e|0}}while(0);do{if((c<<24>>24|0)>=97){if((c<<24>>24|0)>102){break}d=(c<<24>>24)-97+10&255;e=d;i=b;return e|0}}while(0);do{if((c<<24>>24|0)>=65){if((c<<24>>24|0)>70){break}d=(c<<24>>24)-65+10&255;e=d;i=b;return e|0}}while(0);d=0;e=d;i=b;return e|0}function Fa(a){a=a|0;var b=0,c=0,d=0,e=0;b=i;i=i+16|0;c=a;a=c&255;if((c&255|0)<=9){d=48+a&255;e=d;i=b;return e|0}else{d=97+(a-10)&255;e=d;i=b;return e|0}return 0}function Ga(b){b=b|0;var e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0;e=i;i=i+712|0;f=e+32|0;g=e+96|0;h=e+160|0;j=b;a:do{if((c[2]|0)==0){c[2]=Pa(65)|0;k=0;while(1){if(!(k>>>0<65)){break a}a[(c[2]|0)+k|0]=0;k=k+1|0}}}while(0);b=0;while(1){l=b;if((a[j+b|0]|0)==0){break}b=l+1|0}b=(l>>>0)/2|0;l=Pa(b)|0;if((l|0)==0){m=c[2]|0;i=e;return m|0}k=0;while(1){if(!(k>>>0<b>>>0)){break}n=((Ea(a[j+(k<<1)|0]|0)|0)&255)<<4;a[l+k|0]=n+((Ea(a[j+((k<<1)+1)|0]|0)|0)&255);k=k+1|0}Ka(h);La(h,l,b);Ma(h,f);Qa(l);Ka(h+272|0);La(h+272|0,f,64);Ma(h+272|0,g);k=0;while(1){if(!(k>>>0<32)){break}h=d[g+k|0]|0;f=Fa(h>>>4&255)|0;a[(c[2]|0)+(k<<1)|0]=f;f=Fa(h&15)|0;a[(c[2]|0)+((k<<1)+1)|0]=f;k=k+1|0}m=c[2]|0;i=e;return m|0}function Ha(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=i;i=i+24|0;e=a;a=b;c[e+128>>2]=0;b=0;while(1){if(!(b>>>0<15)){break}f=e+136+(b<<3)|0;c[f>>2]=0;c[f+4>>2]=0;b=b+1|0}b=e+256|0;c[b>>2]=a;c[b+4>>2]=0;b=e+264|0;c[b>>2]=0;c[b+4>>2]=0;i=d;return}function Ia(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0;e=i;i=i+968|0;f=e+40|0;g=e+176|0;h=e+304|0;j=e+448|0;k=e+576|0;l=e+712|0;m=e+840|0;n=a;a=b;b=d;d=n;o=c[n+128>>2]|0;if(b>>>0<(128-o|0)>>>0){Xa(d+o|0,a|0,b|0)|0;o=o+b|0;c[n+128>>2]=o;i=e;return}p=f+0|0;q=n+136|0;r=p+128|0;do{c[p>>2]=c[q>>2];p=p+4|0;q=q+4|0}while((p|0)<(r|0));while(1){if(!(b>>>0>0)){break}s=128-o|0;if(s>>>0>b>>>0){s=b}Xa(d+o|0,a|0,s|0)|0;o=o+s|0;a=a+s|0;b=b-s|0;if((o|0)!=128){continue}s=0;while(1){if(!(s>>>0<16)){break}t=Oa(d+(s<<3)|0)|0;u=h+(s<<3)|0;c[u>>2]=t;c[u+4>>2]=D;u=h+(s<<3)|0;t=f+(s<<3)|0;v=c[u+4>>2]^c[t+4>>2];w=g+(s<<3)|0;c[w>>2]=c[u>>2]^c[t>>2];c[w+4>>2]=v;s=s+1|0}v=0;while(1){if((v|0)>=14){break}w=v+0|0;t=Va(w|0,((w|0)<0)<<31>>31|0,56)|0;w=g;u=w;x=c[u+4>>2]^D;y=w;c[y>>2]=c[u>>2]^t;c[y+4>>2]=x;x=v+16|0;y=Va(x|0,((x|0)<0)<<31>>31|0,56)|0;x=g+8|0;t=x;u=c[t+4>>2]^D;w=x;c[w>>2]=c[t>>2]^y;c[w+4>>2]=u;u=v+32|0;w=Va(u|0,((u|0)<0)<<31>>31|0,56)|0;u=g+16|0;y=u;t=c[y+4>>2]^D;x=u;c[x>>2]=c[y>>2]^w;c[x+4>>2]=t;t=v+48|0;x=Va(t|0,((t|0)<0)<<31>>31|0,56)|0;t=g+24|0;w=t;y=c[w+4>>2]^D;u=t;c[u>>2]=c[w>>2]^x;c[u+4>>2]=y;y=v+64|0;u=Va(y|0,((y|0)<0)<<31>>31|0,56)|0;y=g+32|0;x=y;w=c[x+4>>2]^D;t=y;c[t>>2]=c[x>>2]^u;c[t+4>>2]=w;w=v+80|0;t=Va(w|0,((w|0)<0)<<31>>31|0,56)|0;w=g+40|0;u=w;x=c[u+4>>2]^D;y=w;c[y>>2]=c[u>>2]^t;c[y+4>>2]=x;x=v+96|0;y=Va(x|0,((x|0)<0)<<31>>31|0,56)|0;x=g+48|0;t=x;u=c[t+4>>2]^D;w=x;c[w>>2]=c[t>>2]^y;c[w+4>>2]=u;u=v+112|0;w=Va(u|0,((u|0)<0)<<31>>31|0,56)|0;u=g+56|0;y=u;t=c[y+4>>2]^D;x=u;c[x>>2]=c[y>>2]^w;c[x+4>>2]=t;t=v+128|0;x=Va(t|0,((t|0)<0)<<31>>31|0,56)|0;t=g+64|0;w=t;y=c[w+4>>2]^D;u=t;c[u>>2]=c[w>>2]^x;c[u+4>>2]=y;y=v+144|0;u=Va(y|0,((y|0)<0)<<31>>31|0,56)|0;y=g+72|0;x=y;w=c[x+4>>2]^D;t=y;c[t>>2]=c[x>>2]^u;c[t+4>>2]=w;w=v+160|0;t=Va(w|0,((w|0)<0)<<31>>31|0,56)|0;w=g+80|0;u=w;x=c[u+4>>2]^D;y=w;c[y>>2]=c[u>>2]^t;c[y+4>>2]=x;x=v+176|0;y=Va(x|0,((x|0)<0)<<31>>31|0,56)|0;x=g+88|0;t=x;u=c[t+4>>2]^D;w=x;c[w>>2]=c[t>>2]^y;c[w+4>>2]=u;u=v+192|0;w=Va(u|0,((u|0)<0)<<31>>31|0,56)|0;u=g+96|0;y=u;t=c[y+4>>2]^D;x=u;c[x>>2]=c[y>>2]^w;c[x+4>>2]=t;t=v+208|0;x=Va(t|0,((t|0)<0)<<31>>31|0,56)|0;t=g+104|0;w=t;y=c[w+4>>2]^D;u=t;c[u>>2]=c[w>>2]^x;c[u+4>>2]=y;y=v+224|0;u=Va(y|0,((y|0)<0)<<31>>31|0,56)|0;y=g+112|0;x=y;w=c[x+4>>2]^D;t=y;c[t>>2]=c[x>>2]^u;c[t+4>>2]=w;w=v+240|0;t=Va(w|0,((w|0)<0)<<31>>31|0,56)|0;w=g+120|0;u=w;x=c[u+4>>2]^D;y=w;c[y>>2]=c[u>>2]^t;c[y+4>>2]=x;x=g;y=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(y<<3)|0;y=c[x>>2]|0;t=c[x+4>>2]|0;x=g+8|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((u&255)<<3)|0;u=y^c[x>>2];y=t^c[x+4>>2];x=g+16|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((t&255)<<3)|0;t=6160+((c[g+28>>2]&255)<<3)|0;w=u^c[x>>2]^c[t>>2];u=y^c[x+4>>2]^c[t+4>>2];t=g+32|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((x&255)<<3)|0;x=w^c[t>>2];w=u^c[t+4>>2];t=g+40|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((u&255)<<3)|0;u=x^c[t>>2];x=w^c[t+4>>2];t=g+48|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((w&255)<<3)|0;w=14352+((c[g+88>>2]&255)<<3)|0;y=x^c[t+4>>2]^c[w+4>>2];x=j;c[x>>2]=u^c[t>>2]^c[w>>2];c[x+4>>2]=y;y=g+8|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(x<<3)|0;x=c[y>>2]|0;w=c[y+4>>2]|0;y=g+16|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((t&255)<<3)|0;t=x^c[y>>2];x=w^c[y+4>>2];y=g+24|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((w&255)<<3)|0;w=6160+((c[g+36>>2]&255)<<3)|0;u=t^c[y>>2]^c[w>>2];t=x^c[y+4>>2]^c[w+4>>2];w=g+40|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((y&255)<<3)|0;y=u^c[w>>2];u=t^c[w+4>>2];w=g+48|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((t&255)<<3)|0;t=y^c[w>>2];y=u^c[w+4>>2];w=g+56|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((u&255)<<3)|0;u=14352+((c[g+96>>2]&255)<<3)|0;x=y^c[w+4>>2]^c[u+4>>2];y=j+8|0;c[y>>2]=t^c[w>>2]^c[u>>2];c[y+4>>2]=x;x=g+16|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(y<<3)|0;y=c[x>>2]|0;u=c[x+4>>2]|0;x=g+24|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((w&255)<<3)|0;w=y^c[x>>2];y=u^c[x+4>>2];x=g+32|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((u&255)<<3)|0;u=6160+((c[g+44>>2]&255)<<3)|0;t=w^c[x>>2]^c[u>>2];w=y^c[x+4>>2]^c[u+4>>2];u=g+48|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,24)|0;u=8208+((x&255)<<3)|0;x=t^c[u>>2];t=w^c[u+4>>2];u=g+56|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,16)|0;u=10256+((w&255)<<3)|0;w=x^c[u>>2];x=t^c[u+4>>2];u=g+64|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,8)|0;u=12304+((t&255)<<3)|0;t=14352+((c[g+104>>2]&255)<<3)|0;y=x^c[u+4>>2]^c[t+4>>2];x=j+16|0;c[x>>2]=w^c[u>>2]^c[t>>2];c[x+4>>2]=y;y=g+24|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(x<<3)|0;x=c[y>>2]|0;t=c[y+4>>2]|0;y=g+32|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((u&255)<<3)|0;u=x^c[y>>2];x=t^c[y+4>>2];y=g+40|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((t&255)<<3)|0;t=6160+((c[g+52>>2]&255)<<3)|0;w=u^c[y>>2]^c[t>>2];u=x^c[y+4>>2]^c[t+4>>2];t=g+56|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((y&255)<<3)|0;y=w^c[t>>2];w=u^c[t+4>>2];t=g+64|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((u&255)<<3)|0;u=y^c[t>>2];y=w^c[t+4>>2];t=g+72|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((w&255)<<3)|0;w=14352+((c[g+112>>2]&255)<<3)|0;x=y^c[t+4>>2]^c[w+4>>2];y=j+24|0;c[y>>2]=u^c[t>>2]^c[w>>2];c[y+4>>2]=x;x=g+32|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(y<<3)|0;y=c[x>>2]|0;w=c[x+4>>2]|0;x=g+40|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((t&255)<<3)|0;t=y^c[x>>2];y=w^c[x+4>>2];x=g+48|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((w&255)<<3)|0;w=6160+((c[g+60>>2]&255)<<3)|0;u=t^c[x>>2]^c[w>>2];t=y^c[x+4>>2]^c[w+4>>2];w=g+64|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((x&255)<<3)|0;x=u^c[w>>2];u=t^c[w+4>>2];w=g+72|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((t&255)<<3)|0;t=x^c[w>>2];x=u^c[w+4>>2];w=g+80|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((u&255)<<3)|0;u=14352+((c[g+120>>2]&255)<<3)|0;y=x^c[w+4>>2]^c[u+4>>2];x=j+32|0;c[x>>2]=t^c[w>>2]^c[u>>2];c[x+4>>2]=y;y=g+40|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(x<<3)|0;x=c[y>>2]|0;u=c[y+4>>2]|0;y=g+48|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((w&255)<<3)|0;w=x^c[y>>2];x=u^c[y+4>>2];y=g+56|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((u&255)<<3)|0;u=6160+((c[g+68>>2]&255)<<3)|0;t=w^c[y>>2]^c[u>>2];w=x^c[y+4>>2]^c[u+4>>2];u=g+72|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,24)|0;u=8208+((y&255)<<3)|0;y=t^c[u>>2];t=w^c[u+4>>2];u=g+80|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,16)|0;u=10256+((w&255)<<3)|0;w=y^c[u>>2];y=t^c[u+4>>2];u=g+88|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,8)|0;u=12304+((t&255)<<3)|0;t=14352+((c[g>>2]&255)<<3)|0;x=y^c[u+4>>2]^c[t+4>>2];y=j+40|0;c[y>>2]=w^c[u>>2]^c[t>>2];c[y+4>>2]=x;x=g+48|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(y<<3)|0;y=c[x>>2]|0;t=c[x+4>>2]|0;x=g+56|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((u&255)<<3)|0;u=y^c[x>>2];y=t^c[x+4>>2];x=g+64|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((t&255)<<3)|0;t=6160+((c[g+76>>2]&255)<<3)|0;w=u^c[x>>2]^c[t>>2];u=y^c[x+4>>2]^c[t+4>>2];t=g+80|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((x&255)<<3)|0;x=w^c[t>>2];w=u^c[t+4>>2];t=g+88|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((u&255)<<3)|0;u=x^c[t>>2];x=w^c[t+4>>2];t=g+96|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((w&255)<<3)|0;w=14352+((c[g+8>>2]&255)<<3)|0;y=x^c[t+4>>2]^c[w+4>>2];x=j+48|0;c[x>>2]=u^c[t>>2]^c[w>>2];c[x+4>>2]=y;y=g+56|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(x<<3)|0;x=c[y>>2]|0;w=c[y+4>>2]|0;y=g+64|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((t&255)<<3)|0;t=x^c[y>>2];x=w^c[y+4>>2];y=g+72|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((w&255)<<3)|0;w=6160+((c[g+84>>2]&255)<<3)|0;u=t^c[y>>2]^c[w>>2];t=x^c[y+4>>2]^c[w+4>>2];w=g+88|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((y&255)<<3)|0;y=u^c[w>>2];u=t^c[w+4>>2];w=g+96|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((t&255)<<3)|0;t=y^c[w>>2];y=u^c[w+4>>2];w=g+104|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((u&255)<<3)|0;u=14352+((c[g+16>>2]&255)<<3)|0;x=y^c[w+4>>2]^c[u+4>>2];y=j+56|0;c[y>>2]=t^c[w>>2]^c[u>>2];c[y+4>>2]=x;x=g+64|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(y<<3)|0;y=c[x>>2]|0;u=c[x+4>>2]|0;x=g+72|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((w&255)<<3)|0;w=y^c[x>>2];y=u^c[x+4>>2];x=g+80|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((u&255)<<3)|0;u=6160+((c[g+92>>2]&255)<<3)|0;t=w^c[x>>2]^c[u>>2];w=y^c[x+4>>2]^c[u+4>>2];u=g+96|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,24)|0;u=8208+((x&255)<<3)|0;x=t^c[u>>2];t=w^c[u+4>>2];u=g+104|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,16)|0;u=10256+((w&255)<<3)|0;w=x^c[u>>2];x=t^c[u+4>>2];u=g+112|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,8)|0;u=12304+((t&255)<<3)|0;t=14352+((c[g+24>>2]&255)<<3)|0;y=x^c[u+4>>2]^c[t+4>>2];x=j+64|0;c[x>>2]=w^c[u>>2]^c[t>>2];c[x+4>>2]=y;y=g+72|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(x<<3)|0;x=c[y>>2]|0;t=c[y+4>>2]|0;y=g+80|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((u&255)<<3)|0;u=x^c[y>>2];x=t^c[y+4>>2];y=g+88|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((t&255)<<3)|0;t=6160+((c[g+100>>2]&255)<<3)|0;w=u^c[y>>2]^c[t>>2];u=x^c[y+4>>2]^c[t+4>>2];t=g+104|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((y&255)<<3)|0;y=w^c[t>>2];w=u^c[t+4>>2];t=g+112|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((u&255)<<3)|0;u=y^c[t>>2];y=w^c[t+4>>2];t=g+120|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((w&255)<<3)|0;w=14352+((c[g+32>>2]&255)<<3)|0;x=y^c[t+4>>2]^c[w+4>>2];y=j+72|0;c[y>>2]=u^c[t>>2]^c[w>>2];c[y+4>>2]=x;x=g+80|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(y<<3)|0;y=c[x>>2]|0;w=c[x+4>>2]|0;x=g+88|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((t&255)<<3)|0;t=y^c[x>>2];y=w^c[x+4>>2];x=g+96|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((w&255)<<3)|0;w=6160+((c[g+108>>2]&255)<<3)|0;u=t^c[x>>2]^c[w>>2];t=y^c[x+4>>2]^c[w+4>>2];w=g+112|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((x&255)<<3)|0;x=u^c[w>>2];u=t^c[w+4>>2];w=g+120|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((t&255)<<3)|0;t=x^c[w>>2];x=u^c[w+4>>2];w=g;u=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((u&255)<<3)|0;u=14352+((c[g+40>>2]&255)<<3)|0;y=x^c[w+4>>2]^c[u+4>>2];x=j+80|0;c[x>>2]=t^c[w>>2]^c[u>>2];c[x+4>>2]=y;y=g+88|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(x<<3)|0;x=c[y>>2]|0;u=c[y+4>>2]|0;y=g+96|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((w&255)<<3)|0;w=x^c[y>>2];x=u^c[y+4>>2];y=g+104|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((u&255)<<3)|0;u=6160+((c[g+116>>2]&255)<<3)|0;t=w^c[y>>2]^c[u>>2];w=x^c[y+4>>2]^c[u+4>>2];u=g+120|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,24)|0;u=8208+((y&255)<<3)|0;y=t^c[u>>2];t=w^c[u+4>>2];u=g;w=Ua(c[u>>2]|0,c[u+4>>2]|0,16)|0;u=10256+((w&255)<<3)|0;w=y^c[u>>2];y=t^c[u+4>>2];u=g+8|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,8)|0;u=12304+((t&255)<<3)|0;t=14352+((c[g+48>>2]&255)<<3)|0;x=y^c[u+4>>2]^c[t+4>>2];y=j+88|0;c[y>>2]=w^c[u>>2]^c[t>>2];c[y+4>>2]=x;x=g+96|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(y<<3)|0;y=c[x>>2]|0;t=c[x+4>>2]|0;x=g+104|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((u&255)<<3)|0;u=y^c[x>>2];y=t^c[x+4>>2];x=g+112|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((t&255)<<3)|0;t=6160+((c[g+124>>2]&255)<<3)|0;w=u^c[x>>2]^c[t>>2];u=y^c[x+4>>2]^c[t+4>>2];t=g;x=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((x&255)<<3)|0;x=w^c[t>>2];w=u^c[t+4>>2];t=g+8|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((u&255)<<3)|0;u=x^c[t>>2];x=w^c[t+4>>2];t=g+16|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((w&255)<<3)|0;w=14352+((c[g+56>>2]&255)<<3)|0;y=x^c[t+4>>2]^c[w+4>>2];x=j+96|0;c[x>>2]=u^c[t>>2]^c[w>>2];c[x+4>>2]=y;y=g+104|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(x<<3)|0;x=c[y>>2]|0;w=c[y+4>>2]|0;y=g+112|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((t&255)<<3)|0;t=x^c[y>>2];x=w^c[y+4>>2];y=g+120|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((w&255)<<3)|0;w=6160+((c[g+4>>2]&255)<<3)|0;u=t^c[y>>2]^c[w>>2];t=x^c[y+4>>2]^c[w+4>>2];w=g+8|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((y&255)<<3)|0;y=u^c[w>>2];u=t^c[w+4>>2];w=g+16|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((t&255)<<3)|0;t=y^c[w>>2];y=u^c[w+4>>2];w=g+24|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((u&255)<<3)|0;u=14352+((c[g+64>>2]&255)<<3)|0;x=y^c[w+4>>2]^c[u+4>>2];y=j+104|0;c[y>>2]=t^c[w>>2]^c[u>>2];c[y+4>>2]=x;x=g+112|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(y<<3)|0;y=c[x>>2]|0;u=c[x+4>>2]|0;x=g+120|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((w&255)<<3)|0;w=y^c[x>>2];y=u^c[x+4>>2];x=g;u=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((u&255)<<3)|0;u=6160+((c[g+12>>2]&255)<<3)|0;t=w^c[x>>2]^c[u>>2];w=y^c[x+4>>2]^c[u+4>>2];u=g+16|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,24)|0;u=8208+((x&255)<<3)|0;x=t^c[u>>2];t=w^c[u+4>>2];u=g+24|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,16)|0;u=10256+((w&255)<<3)|0;w=x^c[u>>2];x=t^c[u+4>>2];u=g+32|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,8)|0;u=12304+((t&255)<<3)|0;t=14352+((c[g+72>>2]&255)<<3)|0;y=x^c[u+4>>2]^c[t+4>>2];x=j+112|0;c[x>>2]=w^c[u>>2]^c[t>>2];c[x+4>>2]=y;y=g+120|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(x<<3)|0;x=c[y>>2]|0;t=c[y+4>>2]|0;y=g;u=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((u&255)<<3)|0;u=x^c[y>>2];x=t^c[y+4>>2];y=g+8|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((t&255)<<3)|0;t=6160+((c[g+20>>2]&255)<<3)|0;w=u^c[y>>2]^c[t>>2];u=x^c[y+4>>2]^c[t+4>>2];t=g+24|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((y&255)<<3)|0;y=w^c[t>>2];w=u^c[t+4>>2];t=g+32|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((u&255)<<3)|0;u=y^c[t>>2];y=w^c[t+4>>2];t=g+40|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((w&255)<<3)|0;w=14352+((c[g+80>>2]&255)<<3)|0;x=y^c[t+4>>2]^c[w+4>>2];y=j+120|0;c[y>>2]=u^c[t>>2]^c[w>>2];c[y+4>>2]=x;x=j;y=c[x+4>>2]|0;w=g;c[w>>2]=c[x>>2];c[w+4>>2]=y;y=j+8|0;w=c[y+4>>2]|0;x=g+8|0;c[x>>2]=c[y>>2];c[x+4>>2]=w;w=j+16|0;x=c[w+4>>2]|0;y=g+16|0;c[y>>2]=c[w>>2];c[y+4>>2]=x;x=j+24|0;y=c[x+4>>2]|0;w=g+24|0;c[w>>2]=c[x>>2];c[w+4>>2]=y;y=j+32|0;w=c[y+4>>2]|0;x=g+32|0;c[x>>2]=c[y>>2];c[x+4>>2]=w;w=j+40|0;x=c[w+4>>2]|0;y=g+40|0;c[y>>2]=c[w>>2];c[y+4>>2]=x;x=j+48|0;y=c[x+4>>2]|0;w=g+48|0;c[w>>2]=c[x>>2];c[w+4>>2]=y;y=j+56|0;w=c[y+4>>2]|0;x=g+56|0;c[x>>2]=c[y>>2];c[x+4>>2]=w;w=j+64|0;x=c[w+4>>2]|0;y=g+64|0;c[y>>2]=c[w>>2];c[y+4>>2]=x;x=j+72|0;y=c[x+4>>2]|0;w=g+72|0;c[w>>2]=c[x>>2];c[w+4>>2]=y;y=j+80|0;w=c[y+4>>2]|0;x=g+80|0;c[x>>2]=c[y>>2];c[x+4>>2]=w;w=j+88|0;x=c[w+4>>2]|0;y=g+88|0;c[y>>2]=c[w>>2];c[y+4>>2]=x;x=j+96|0;y=c[x+4>>2]|0;w=g+96|0;c[w>>2]=c[x>>2];c[w+4>>2]=y;y=j+104|0;w=c[y+4>>2]|0;x=g+104|0;c[x>>2]=c[y>>2];c[x+4>>2]=w;w=j+112|0;x=c[w+4>>2]|0;y=g+112|0;c[y>>2]=c[w>>2];c[y+4>>2]=x;x=j+120|0;y=c[x+4>>2]|0;w=g+120|0;c[w>>2]=c[x>>2];c[w+4>>2]=y;y=v+1|0;w=Va(y|0,((y|0)<0)<<31>>31|0,56)|0;y=g;x=y;t=c[x+4>>2]^D;u=y;c[u>>2]=c[x>>2]^w;c[u+4>>2]=t;t=v+17|0;u=Va(t|0,((t|0)<0)<<31>>31|0,56)|0;t=g+8|0;w=t;x=c[w+4>>2]^D;y=t;c[y>>2]=c[w>>2]^u;c[y+4>>2]=x;x=v+33|0;y=Va(x|0,((x|0)<0)<<31>>31|0,56)|0;x=g+16|0;u=x;w=c[u+4>>2]^D;t=x;c[t>>2]=c[u>>2]^y;c[t+4>>2]=w;w=v+49|0;t=Va(w|0,((w|0)<0)<<31>>31|0,56)|0;w=g+24|0;y=w;u=c[y+4>>2]^D;x=w;c[x>>2]=c[y>>2]^t;c[x+4>>2]=u;u=v+65|0;x=Va(u|0,((u|0)<0)<<31>>31|0,56)|0;u=g+32|0;t=u;y=c[t+4>>2]^D;w=u;c[w>>2]=c[t>>2]^x;c[w+4>>2]=y;y=v+81|0;w=Va(y|0,((y|0)<0)<<31>>31|0,56)|0;y=g+40|0;x=y;t=c[x+4>>2]^D;u=y;c[u>>2]=c[x>>2]^w;c[u+4>>2]=t;t=v+97|0;u=Va(t|0,((t|0)<0)<<31>>31|0,56)|0;t=g+48|0;w=t;x=c[w+4>>2]^D;y=t;c[y>>2]=c[w>>2]^u;c[y+4>>2]=x;x=v+113|0;y=Va(x|0,((x|0)<0)<<31>>31|0,56)|0;x=g+56|0;u=x;w=c[u+4>>2]^D;t=x;c[t>>2]=c[u>>2]^y;c[t+4>>2]=w;w=v+129|0;t=Va(w|0,((w|0)<0)<<31>>31|0,56)|0;w=g+64|0;y=w;u=c[y+4>>2]^D;x=w;c[x>>2]=c[y>>2]^t;c[x+4>>2]=u;u=v+145|0;x=Va(u|0,((u|0)<0)<<31>>31|0,56)|0;u=g+72|0;t=u;y=c[t+4>>2]^D;w=u;c[w>>2]=c[t>>2]^x;c[w+4>>2]=y;y=v+161|0;w=Va(y|0,((y|0)<0)<<31>>31|0,56)|0;y=g+80|0;x=y;t=c[x+4>>2]^D;u=y;c[u>>2]=c[x>>2]^w;c[u+4>>2]=t;t=v+177|0;u=Va(t|0,((t|0)<0)<<31>>31|0,56)|0;t=g+88|0;w=t;x=c[w+4>>2]^D;y=t;c[y>>2]=c[w>>2]^u;c[y+4>>2]=x;x=v+193|0;y=Va(x|0,((x|0)<0)<<31>>31|0,56)|0;x=g+96|0;u=x;w=c[u+4>>2]^D;t=x;c[t>>2]=c[u>>2]^y;c[t+4>>2]=w;w=v+209|0;t=Va(w|0,((w|0)<0)<<31>>31|0,56)|0;w=g+104|0;y=w;u=c[y+4>>2]^D;x=w;c[x>>2]=c[y>>2]^t;c[x+4>>2]=u;u=v+225|0;x=Va(u|0,((u|0)<0)<<31>>31|0,56)|0;u=g+112|0;t=u;y=c[t+4>>2]^D;w=u;c[w>>2]=c[t>>2]^x;c[w+4>>2]=y;y=v+241|0;w=Va(y|0,((y|0)<0)<<31>>31|0,56)|0;y=g+120|0;x=y;t=c[x+4>>2]^D;u=y;c[u>>2]=c[x>>2]^w;c[u+4>>2]=t;t=g;u=Ua(c[t>>2]|0,c[t+4>>2]|0,56)|0;t=16+(u<<3)|0;u=c[t>>2]|0;w=c[t+4>>2]|0;t=g+8|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,48)|0;t=2064+((x&255)<<3)|0;x=u^c[t>>2];u=w^c[t+4>>2];t=g+16|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,40)|0;t=4112+((w&255)<<3)|0;w=6160+((c[g+28>>2]&255)<<3)|0;y=x^c[t>>2]^c[w>>2];x=u^c[t+4>>2]^c[w+4>>2];w=g+32|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((t&255)<<3)|0;t=y^c[w>>2];y=x^c[w+4>>2];w=g+40|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((x&255)<<3)|0;x=t^c[w>>2];t=y^c[w+4>>2];w=g+48|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((y&255)<<3)|0;y=14352+((c[g+88>>2]&255)<<3)|0;u=t^c[w+4>>2]^c[y+4>>2];t=k;c[t>>2]=x^c[w>>2]^c[y>>2];c[t+4>>2]=u;u=g+8|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(t<<3)|0;t=c[u>>2]|0;y=c[u+4>>2]|0;u=g+16|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((w&255)<<3)|0;w=t^c[u>>2];t=y^c[u+4>>2];u=g+24|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((y&255)<<3)|0;y=6160+((c[g+36>>2]&255)<<3)|0;x=w^c[u>>2]^c[y>>2];w=t^c[u+4>>2]^c[y+4>>2];y=g+40|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,24)|0;y=8208+((u&255)<<3)|0;u=x^c[y>>2];x=w^c[y+4>>2];y=g+48|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,16)|0;y=10256+((w&255)<<3)|0;w=u^c[y>>2];u=x^c[y+4>>2];y=g+56|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,8)|0;y=12304+((x&255)<<3)|0;x=14352+((c[g+96>>2]&255)<<3)|0;t=u^c[y+4>>2]^c[x+4>>2];u=k+8|0;c[u>>2]=w^c[y>>2]^c[x>>2];c[u+4>>2]=t;t=g+16|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,56)|0;t=16+(u<<3)|0;u=c[t>>2]|0;x=c[t+4>>2]|0;t=g+24|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,48)|0;t=2064+((y&255)<<3)|0;y=u^c[t>>2];u=x^c[t+4>>2];t=g+32|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,40)|0;t=4112+((x&255)<<3)|0;x=6160+((c[g+44>>2]&255)<<3)|0;w=y^c[t>>2]^c[x>>2];y=u^c[t+4>>2]^c[x+4>>2];x=g+48|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,24)|0;x=8208+((t&255)<<3)|0;t=w^c[x>>2];w=y^c[x+4>>2];x=g+56|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,16)|0;x=10256+((y&255)<<3)|0;y=t^c[x>>2];t=w^c[x+4>>2];x=g+64|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,8)|0;x=12304+((w&255)<<3)|0;w=14352+((c[g+104>>2]&255)<<3)|0;u=t^c[x+4>>2]^c[w+4>>2];t=k+16|0;c[t>>2]=y^c[x>>2]^c[w>>2];c[t+4>>2]=u;u=g+24|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(t<<3)|0;t=c[u>>2]|0;w=c[u+4>>2]|0;u=g+32|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((x&255)<<3)|0;x=t^c[u>>2];t=w^c[u+4>>2];u=g+40|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((w&255)<<3)|0;w=6160+((c[g+52>>2]&255)<<3)|0;y=x^c[u>>2]^c[w>>2];x=t^c[u+4>>2]^c[w+4>>2];w=g+56|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((u&255)<<3)|0;u=y^c[w>>2];y=x^c[w+4>>2];w=g+64|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((x&255)<<3)|0;x=u^c[w>>2];u=y^c[w+4>>2];w=g+72|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((y&255)<<3)|0;y=14352+((c[g+112>>2]&255)<<3)|0;t=u^c[w+4>>2]^c[y+4>>2];u=k+24|0;c[u>>2]=x^c[w>>2]^c[y>>2];c[u+4>>2]=t;t=g+32|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,56)|0;t=16+(u<<3)|0;u=c[t>>2]|0;y=c[t+4>>2]|0;t=g+40|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,48)|0;t=2064+((w&255)<<3)|0;w=u^c[t>>2];u=y^c[t+4>>2];t=g+48|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,40)|0;t=4112+((y&255)<<3)|0;y=6160+((c[g+60>>2]&255)<<3)|0;x=w^c[t>>2]^c[y>>2];w=u^c[t+4>>2]^c[y+4>>2];y=g+64|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,24)|0;y=8208+((t&255)<<3)|0;t=x^c[y>>2];x=w^c[y+4>>2];y=g+72|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,16)|0;y=10256+((w&255)<<3)|0;w=t^c[y>>2];t=x^c[y+4>>2];y=g+80|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,8)|0;y=12304+((x&255)<<3)|0;x=14352+((c[g+120>>2]&255)<<3)|0;u=t^c[y+4>>2]^c[x+4>>2];t=k+32|0;c[t>>2]=w^c[y>>2]^c[x>>2];c[t+4>>2]=u;u=g+40|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(t<<3)|0;t=c[u>>2]|0;x=c[u+4>>2]|0;u=g+48|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((y&255)<<3)|0;y=t^c[u>>2];t=x^c[u+4>>2];u=g+56|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((x&255)<<3)|0;x=6160+((c[g+68>>2]&255)<<3)|0;w=y^c[u>>2]^c[x>>2];y=t^c[u+4>>2]^c[x+4>>2];x=g+72|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,24)|0;x=8208+((u&255)<<3)|0;u=w^c[x>>2];w=y^c[x+4>>2];x=g+80|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,16)|0;x=10256+((y&255)<<3)|0;y=u^c[x>>2];u=w^c[x+4>>2];x=g+88|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,8)|0;x=12304+((w&255)<<3)|0;w=14352+((c[g>>2]&255)<<3)|0;t=u^c[x+4>>2]^c[w+4>>2];u=k+40|0;c[u>>2]=y^c[x>>2]^c[w>>2];c[u+4>>2]=t;t=g+48|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,56)|0;t=16+(u<<3)|0;u=c[t>>2]|0;w=c[t+4>>2]|0;t=g+56|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,48)|0;t=2064+((x&255)<<3)|0;x=u^c[t>>2];u=w^c[t+4>>2];t=g+64|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,40)|0;t=4112+((w&255)<<3)|0;w=6160+((c[g+76>>2]&255)<<3)|0;y=x^c[t>>2]^c[w>>2];x=u^c[t+4>>2]^c[w+4>>2];w=g+80|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((t&255)<<3)|0;t=y^c[w>>2];y=x^c[w+4>>2];w=g+88|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((x&255)<<3)|0;x=t^c[w>>2];t=y^c[w+4>>2];w=g+96|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((y&255)<<3)|0;y=14352+((c[g+8>>2]&255)<<3)|0;u=t^c[w+4>>2]^c[y+4>>2];t=k+48|0;c[t>>2]=x^c[w>>2]^c[y>>2];c[t+4>>2]=u;u=g+56|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(t<<3)|0;t=c[u>>2]|0;y=c[u+4>>2]|0;u=g+64|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((w&255)<<3)|0;w=t^c[u>>2];t=y^c[u+4>>2];u=g+72|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((y&255)<<3)|0;y=6160+((c[g+84>>2]&255)<<3)|0;x=w^c[u>>2]^c[y>>2];w=t^c[u+4>>2]^c[y+4>>2];y=g+88|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,24)|0;y=8208+((u&255)<<3)|0;u=x^c[y>>2];x=w^c[y+4>>2];y=g+96|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,16)|0;y=10256+((w&255)<<3)|0;w=u^c[y>>2];u=x^c[y+4>>2];y=g+104|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,8)|0;y=12304+((x&255)<<3)|0;x=14352+((c[g+16>>2]&255)<<3)|0;t=u^c[y+4>>2]^c[x+4>>2];u=k+56|0;c[u>>2]=w^c[y>>2]^c[x>>2];c[u+4>>2]=t;t=g+64|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,56)|0;t=16+(u<<3)|0;u=c[t>>2]|0;x=c[t+4>>2]|0;t=g+72|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,48)|0;t=2064+((y&255)<<3)|0;y=u^c[t>>2];u=x^c[t+4>>2];t=g+80|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,40)|0;t=4112+((x&255)<<3)|0;x=6160+((c[g+92>>2]&255)<<3)|0;w=y^c[t>>2]^c[x>>2];y=u^c[t+4>>2]^c[x+4>>2];x=g+96|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,24)|0;x=8208+((t&255)<<3)|0;t=w^c[x>>2];w=y^c[x+4>>2];x=g+104|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,16)|0;x=10256+((y&255)<<3)|0;y=t^c[x>>2];t=w^c[x+4>>2];x=g+112|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,8)|0;x=12304+((w&255)<<3)|0;w=14352+((c[g+24>>2]&255)<<3)|0;u=t^c[x+4>>2]^c[w+4>>2];t=k+64|0;c[t>>2]=y^c[x>>2]^c[w>>2];c[t+4>>2]=u;u=g+72|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(t<<3)|0;t=c[u>>2]|0;w=c[u+4>>2]|0;u=g+80|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((x&255)<<3)|0;x=t^c[u>>2];t=w^c[u+4>>2];u=g+88|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((w&255)<<3)|0;w=6160+((c[g+100>>2]&255)<<3)|0;y=x^c[u>>2]^c[w>>2];x=t^c[u+4>>2]^c[w+4>>2];w=g+104|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((u&255)<<3)|0;u=y^c[w>>2];y=x^c[w+4>>2];w=g+112|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((x&255)<<3)|0;x=u^c[w>>2];u=y^c[w+4>>2];w=g+120|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((y&255)<<3)|0;y=14352+((c[g+32>>2]&255)<<3)|0;t=u^c[w+4>>2]^c[y+4>>2];u=k+72|0;c[u>>2]=x^c[w>>2]^c[y>>2];c[u+4>>2]=t;t=g+80|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,56)|0;t=16+(u<<3)|0;u=c[t>>2]|0;y=c[t+4>>2]|0;t=g+88|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,48)|0;t=2064+((w&255)<<3)|0;w=u^c[t>>2];u=y^c[t+4>>2];t=g+96|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,40)|0;t=4112+((y&255)<<3)|0;y=6160+((c[g+108>>2]&255)<<3)|0;x=w^c[t>>2]^c[y>>2];w=u^c[t+4>>2]^c[y+4>>2];y=g+112|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,24)|0;y=8208+((t&255)<<3)|0;t=x^c[y>>2];x=w^c[y+4>>2];y=g+120|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,16)|0;y=10256+((w&255)<<3)|0;w=t^c[y>>2];t=x^c[y+4>>2];y=g;x=Ua(c[y>>2]|0,c[y+4>>2]|0,8)|0;y=12304+((x&255)<<3)|0;x=14352+((c[g+40>>2]&255)<<3)|0;u=t^c[y+4>>2]^c[x+4>>2];t=k+80|0;c[t>>2]=w^c[y>>2]^c[x>>2];c[t+4>>2]=u;u=g+88|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(t<<3)|0;t=c[u>>2]|0;x=c[u+4>>2]|0;u=g+96|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((y&255)<<3)|0;y=t^c[u>>2];t=x^c[u+4>>2];u=g+104|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((x&255)<<3)|0;x=6160+((c[g+116>>2]&255)<<3)|0;w=y^c[u>>2]^c[x>>2];y=t^c[u+4>>2]^c[x+4>>2];x=g+120|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,24)|0;x=8208+((u&255)<<3)|0;u=w^c[x>>2];w=y^c[x+4>>2];x=g;y=Ua(c[x>>2]|0,c[x+4>>2]|0,16)|0;x=10256+((y&255)<<3)|0;y=u^c[x>>2];u=w^c[x+4>>2];x=g+8|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,8)|0;x=12304+((w&255)<<3)|0;w=14352+((c[g+48>>2]&255)<<3)|0;t=u^c[x+4>>2]^c[w+4>>2];u=k+88|0;c[u>>2]=y^c[x>>2]^c[w>>2];c[u+4>>2]=t;t=g+96|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,56)|0;t=16+(u<<3)|0;u=c[t>>2]|0;w=c[t+4>>2]|0;t=g+104|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,48)|0;t=2064+((x&255)<<3)|0;x=u^c[t>>2];u=w^c[t+4>>2];t=g+112|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,40)|0;t=4112+((w&255)<<3)|0;w=6160+((c[g+124>>2]&255)<<3)|0;y=x^c[t>>2]^c[w>>2];x=u^c[t+4>>2]^c[w+4>>2];w=g;t=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((t&255)<<3)|0;t=y^c[w>>2];y=x^c[w+4>>2];w=g+8|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((x&255)<<3)|0;x=t^c[w>>2];t=y^c[w+4>>2];w=g+16|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((y&255)<<3)|0;y=14352+((c[g+56>>2]&255)<<3)|0;u=t^c[w+4>>2]^c[y+4>>2];t=k+96|0;c[t>>2]=x^c[w>>2]^c[y>>2];c[t+4>>2]=u;u=g+104|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(t<<3)|0;t=c[u>>2]|0;y=c[u+4>>2]|0;u=g+112|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((w&255)<<3)|0;w=t^c[u>>2];t=y^c[u+4>>2];u=g+120|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((y&255)<<3)|0;y=6160+((c[g+4>>2]&255)<<3)|0;x=w^c[u>>2]^c[y>>2];w=t^c[u+4>>2]^c[y+4>>2];y=g+8|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,24)|0;y=8208+((u&255)<<3)|0;u=x^c[y>>2];x=w^c[y+4>>2];y=g+16|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,16)|0;y=10256+((w&255)<<3)|0;w=u^c[y>>2];u=x^c[y+4>>2];y=g+24|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,8)|0;y=12304+((x&255)<<3)|0;x=14352+((c[g+64>>2]&255)<<3)|0;t=u^c[y+4>>2]^c[x+4>>2];u=k+104|0;c[u>>2]=w^c[y>>2]^c[x>>2];c[u+4>>2]=t;t=g+112|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,56)|0;t=16+(u<<3)|0;u=c[t>>2]|0;x=c[t+4>>2]|0;t=g+120|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,48)|0;t=2064+((y&255)<<3)|0;y=u^c[t>>2];u=x^c[t+4>>2];t=g;x=Ua(c[t>>2]|0,c[t+4>>2]|0,40)|0;t=4112+((x&255)<<3)|0;x=6160+((c[g+12>>2]&255)<<3)|0;w=y^c[t>>2]^c[x>>2];y=u^c[t+4>>2]^c[x+4>>2];x=g+16|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,24)|0;x=8208+((t&255)<<3)|0;t=w^c[x>>2];w=y^c[x+4>>2];x=g+24|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,16)|0;x=10256+((y&255)<<3)|0;y=t^c[x>>2];t=w^c[x+4>>2];x=g+32|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,8)|0;x=12304+((w&255)<<3)|0;w=14352+((c[g+72>>2]&255)<<3)|0;u=t^c[x+4>>2]^c[w+4>>2];t=k+112|0;c[t>>2]=y^c[x>>2]^c[w>>2];c[t+4>>2]=u;u=g+120|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(t<<3)|0;t=c[u>>2]|0;w=c[u+4>>2]|0;u=g;x=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((x&255)<<3)|0;x=t^c[u>>2];t=w^c[u+4>>2];u=g+8|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((w&255)<<3)|0;w=6160+((c[g+20>>2]&255)<<3)|0;y=x^c[u>>2]^c[w>>2];x=t^c[u+4>>2]^c[w+4>>2];w=g+24|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((u&255)<<3)|0;u=y^c[w>>2];y=x^c[w+4>>2];w=g+32|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((x&255)<<3)|0;x=u^c[w>>2];u=y^c[w+4>>2];w=g+40|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((y&255)<<3)|0;y=14352+((c[g+80>>2]&255)<<3)|0;t=u^c[w+4>>2]^c[y+4>>2];u=k+120|0;c[u>>2]=x^c[w>>2]^c[y>>2];c[u+4>>2]=t;t=k;u=c[t+4>>2]|0;y=g;c[y>>2]=c[t>>2];c[y+4>>2]=u;u=k+8|0;y=c[u+4>>2]|0;t=g+8|0;c[t>>2]=c[u>>2];c[t+4>>2]=y;y=k+16|0;t=c[y+4>>2]|0;u=g+16|0;c[u>>2]=c[y>>2];c[u+4>>2]=t;t=k+24|0;u=c[t+4>>2]|0;y=g+24|0;c[y>>2]=c[t>>2];c[y+4>>2]=u;u=k+32|0;y=c[u+4>>2]|0;t=g+32|0;c[t>>2]=c[u>>2];c[t+4>>2]=y;y=k+40|0;t=c[y+4>>2]|0;u=g+40|0;c[u>>2]=c[y>>2];c[u+4>>2]=t;t=k+48|0;u=c[t+4>>2]|0;y=g+48|0;c[y>>2]=c[t>>2];c[y+4>>2]=u;u=k+56|0;y=c[u+4>>2]|0;t=g+56|0;c[t>>2]=c[u>>2];c[t+4>>2]=y;y=k+64|0;t=c[y+4>>2]|0;u=g+64|0;c[u>>2]=c[y>>2];c[u+4>>2]=t;t=k+72|0;u=c[t+4>>2]|0;y=g+72|0;c[y>>2]=c[t>>2];c[y+4>>2]=u;u=k+80|0;y=c[u+4>>2]|0;t=g+80|0;c[t>>2]=c[u>>2];c[t+4>>2]=y;y=k+88|0;t=c[y+4>>2]|0;u=g+88|0;c[u>>2]=c[y>>2];c[u+4>>2]=t;t=k+96|0;u=c[t+4>>2]|0;y=g+96|0;c[y>>2]=c[t>>2];c[y+4>>2]=u;u=k+104|0;y=c[u+4>>2]|0;t=g+104|0;c[t>>2]=c[u>>2];c[t+4>>2]=y;y=k+112|0;t=c[y+4>>2]|0;u=g+112|0;c[u>>2]=c[y>>2];c[u+4>>2]=t;t=k+120|0;u=c[t+4>>2]|0;y=g+120|0;c[y>>2]=c[t>>2];c[y+4>>2]=u;v=v+2|0}v=0;while(1){if((v|0)>=14){break}u=v+0|0;y=h;t=y;w=c[t+4>>2]^~(((u|0)<0)<<31>>31);x=y;c[x>>2]=c[t>>2]^~u;c[x+4>>2]=w;w=v+0|0;x=h+8|0;u=x;t=c[u+4>>2]^~(((w|0)<0)<<31>>31);y=x;c[y>>2]=c[u>>2]^(w^-17);c[y+4>>2]=t;t=v+0|0;y=h+16|0;w=y;u=c[w+4>>2]^~(((t|0)<0)<<31>>31);x=y;c[x>>2]=c[w>>2]^(t^-33);c[x+4>>2]=u;u=v+0|0;x=h+24|0;t=x;w=c[t+4>>2]^~(((u|0)<0)<<31>>31);y=x;c[y>>2]=c[t>>2]^(u^-49);c[y+4>>2]=w;w=v+0|0;y=h+32|0;u=y;t=c[u+4>>2]^~(((w|0)<0)<<31>>31);x=y;c[x>>2]=c[u>>2]^(w^-65);c[x+4>>2]=t;t=v+0|0;x=h+40|0;w=x;u=c[w+4>>2]^~(((t|0)<0)<<31>>31);y=x;c[y>>2]=c[w>>2]^(t^-81);c[y+4>>2]=u;u=v+0|0;y=h+48|0;t=y;w=c[t+4>>2]^~(((u|0)<0)<<31>>31);x=y;c[x>>2]=c[t>>2]^(u^-97);c[x+4>>2]=w;w=v+0|0;x=h+56|0;u=x;t=c[u+4>>2]^~(((w|0)<0)<<31>>31);y=x;c[y>>2]=c[u>>2]^(w^-113);c[y+4>>2]=t;t=v+0|0;y=h+64|0;w=y;u=c[w+4>>2]^~(((t|0)<0)<<31>>31);x=y;c[x>>2]=c[w>>2]^(t^-129);c[x+4>>2]=u;u=v+0|0;x=h+72|0;t=x;w=c[t+4>>2]^~(((u|0)<0)<<31>>31);y=x;c[y>>2]=c[t>>2]^(u^-145);c[y+4>>2]=w;w=v+0|0;y=h+80|0;u=y;t=c[u+4>>2]^~(((w|0)<0)<<31>>31);x=y;c[x>>2]=c[u>>2]^(w^-161);c[x+4>>2]=t;t=v+0|0;x=h+88|0;w=x;u=c[w+4>>2]^~(((t|0)<0)<<31>>31);y=x;c[y>>2]=c[w>>2]^(t^-177);c[y+4>>2]=u;u=v+0|0;y=h+96|0;t=y;w=c[t+4>>2]^~(((u|0)<0)<<31>>31);x=y;c[x>>2]=c[t>>2]^(u^-193);c[x+4>>2]=w;w=v+0|0;x=h+104|0;u=x;t=c[u+4>>2]^~(((w|0)<0)<<31>>31);y=x;c[y>>2]=c[u>>2]^(w^-209);c[y+4>>2]=t;t=v+0|0;y=h+112|0;w=y;u=c[w+4>>2]^~(((t|0)<0)<<31>>31);x=y;c[x>>2]=c[w>>2]^(t^-225);c[x+4>>2]=u;u=v+0|0;x=h+120|0;t=x;w=c[t+4>>2]^~(((u|0)<0)<<31>>31);y=x;c[y>>2]=c[t>>2]^(u^-241);c[y+4>>2]=w;w=h+8|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,56)|0;w=16+(y<<3)|0;y=c[w>>2]|0;u=c[w+4>>2]|0;w=h+24|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,48)|0;w=2064+((t&255)<<3)|0;t=y^c[w>>2];y=u^c[w+4>>2];w=h+40|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,40)|0;w=4112+((u&255)<<3)|0;u=6160+((c[h+92>>2]&255)<<3)|0;x=t^c[w>>2]^c[u>>2];t=y^c[w+4>>2]^c[u+4>>2];u=h;w=Ua(c[u>>2]|0,c[u+4>>2]|0,24)|0;u=8208+((w&255)<<3)|0;w=x^c[u>>2];x=t^c[u+4>>2];u=h+16|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,16)|0;u=10256+((t&255)<<3)|0;t=w^c[u>>2];w=x^c[u+4>>2];u=h+32|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,8)|0;u=12304+((x&255)<<3)|0;x=14352+((c[h+48>>2]&255)<<3)|0;y=w^c[u+4>>2]^c[x+4>>2];w=l;c[w>>2]=t^c[u>>2]^c[x>>2];c[w+4>>2]=y;y=h+16|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(w<<3)|0;w=c[y>>2]|0;x=c[y+4>>2]|0;y=h+32|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((u&255)<<3)|0;u=w^c[y>>2];w=x^c[y+4>>2];y=h+48|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((x&255)<<3)|0;x=6160+((c[h+100>>2]&255)<<3)|0;t=u^c[y>>2]^c[x>>2];u=w^c[y+4>>2]^c[x+4>>2];x=h+8|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,24)|0;x=8208+((y&255)<<3)|0;y=t^c[x>>2];t=u^c[x+4>>2];x=h+24|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,16)|0;x=10256+((u&255)<<3)|0;u=y^c[x>>2];y=t^c[x+4>>2];x=h+40|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,8)|0;x=12304+((t&255)<<3)|0;t=14352+((c[h+56>>2]&255)<<3)|0;w=y^c[x+4>>2]^c[t+4>>2];y=l+8|0;c[y>>2]=u^c[x>>2]^c[t>>2];c[y+4>>2]=w;w=h+24|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,56)|0;w=16+(y<<3)|0;y=c[w>>2]|0;t=c[w+4>>2]|0;w=h+40|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,48)|0;w=2064+((x&255)<<3)|0;x=y^c[w>>2];y=t^c[w+4>>2];w=h+56|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,40)|0;w=4112+((t&255)<<3)|0;t=6160+((c[h+108>>2]&255)<<3)|0;u=x^c[w>>2]^c[t>>2];x=y^c[w+4>>2]^c[t+4>>2];t=h+16|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((w&255)<<3)|0;w=u^c[t>>2];u=x^c[t+4>>2];t=h+32|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((x&255)<<3)|0;x=w^c[t>>2];w=u^c[t+4>>2];t=h+48|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((u&255)<<3)|0;u=14352+((c[h+64>>2]&255)<<3)|0;y=w^c[t+4>>2]^c[u+4>>2];w=l+16|0;c[w>>2]=x^c[t>>2]^c[u>>2];c[w+4>>2]=y;y=h+32|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(w<<3)|0;w=c[y>>2]|0;u=c[y+4>>2]|0;y=h+48|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((t&255)<<3)|0;t=w^c[y>>2];w=u^c[y+4>>2];y=h+64|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((u&255)<<3)|0;u=6160+((c[h+116>>2]&255)<<3)|0;x=t^c[y>>2]^c[u>>2];t=w^c[y+4>>2]^c[u+4>>2];u=h+24|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,24)|0;u=8208+((y&255)<<3)|0;y=x^c[u>>2];x=t^c[u+4>>2];u=h+40|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,16)|0;u=10256+((t&255)<<3)|0;t=y^c[u>>2];y=x^c[u+4>>2];u=h+56|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,8)|0;u=12304+((x&255)<<3)|0;x=14352+((c[h+72>>2]&255)<<3)|0;w=y^c[u+4>>2]^c[x+4>>2];y=l+24|0;c[y>>2]=t^c[u>>2]^c[x>>2];c[y+4>>2]=w;w=h+40|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,56)|0;w=16+(y<<3)|0;y=c[w>>2]|0;x=c[w+4>>2]|0;w=h+56|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,48)|0;w=2064+((u&255)<<3)|0;u=y^c[w>>2];y=x^c[w+4>>2];w=h+72|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,40)|0;w=4112+((x&255)<<3)|0;x=6160+((c[h+124>>2]&255)<<3)|0;t=u^c[w>>2]^c[x>>2];u=y^c[w+4>>2]^c[x+4>>2];x=h+32|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,24)|0;x=8208+((w&255)<<3)|0;w=t^c[x>>2];t=u^c[x+4>>2];x=h+48|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,16)|0;x=10256+((u&255)<<3)|0;u=w^c[x>>2];w=t^c[x+4>>2];x=h+64|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,8)|0;x=12304+((t&255)<<3)|0;t=14352+((c[h+80>>2]&255)<<3)|0;y=w^c[x+4>>2]^c[t+4>>2];w=l+32|0;c[w>>2]=u^c[x>>2]^c[t>>2];c[w+4>>2]=y;y=h+48|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(w<<3)|0;w=c[y>>2]|0;t=c[y+4>>2]|0;y=h+64|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((x&255)<<3)|0;x=w^c[y>>2];w=t^c[y+4>>2];y=h+80|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((t&255)<<3)|0;t=6160+((c[h+4>>2]&255)<<3)|0;u=x^c[y>>2]^c[t>>2];x=w^c[y+4>>2]^c[t+4>>2];t=h+40|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((y&255)<<3)|0;y=u^c[t>>2];u=x^c[t+4>>2];t=h+56|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((x&255)<<3)|0;x=y^c[t>>2];y=u^c[t+4>>2];t=h+72|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((u&255)<<3)|0;u=14352+((c[h+88>>2]&255)<<3)|0;w=y^c[t+4>>2]^c[u+4>>2];y=l+40|0;c[y>>2]=x^c[t>>2]^c[u>>2];c[y+4>>2]=w;w=h+56|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,56)|0;w=16+(y<<3)|0;y=c[w>>2]|0;u=c[w+4>>2]|0;w=h+72|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,48)|0;w=2064+((t&255)<<3)|0;t=y^c[w>>2];y=u^c[w+4>>2];w=h+88|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,40)|0;w=4112+((u&255)<<3)|0;u=6160+((c[h+12>>2]&255)<<3)|0;x=t^c[w>>2]^c[u>>2];t=y^c[w+4>>2]^c[u+4>>2];u=h+48|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,24)|0;u=8208+((w&255)<<3)|0;w=x^c[u>>2];x=t^c[u+4>>2];u=h+64|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,16)|0;u=10256+((t&255)<<3)|0;t=w^c[u>>2];w=x^c[u+4>>2];u=h+80|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,8)|0;u=12304+((x&255)<<3)|0;x=14352+((c[h+96>>2]&255)<<3)|0;y=w^c[u+4>>2]^c[x+4>>2];w=l+48|0;c[w>>2]=t^c[u>>2]^c[x>>2];c[w+4>>2]=y;y=h+64|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(w<<3)|0;w=c[y>>2]|0;x=c[y+4>>2]|0;y=h+80|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((u&255)<<3)|0;u=w^c[y>>2];w=x^c[y+4>>2];y=h+96|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((x&255)<<3)|0;x=6160+((c[h+20>>2]&255)<<3)|0;t=u^c[y>>2]^c[x>>2];u=w^c[y+4>>2]^c[x+4>>2];x=h+56|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,24)|0;x=8208+((y&255)<<3)|0;y=t^c[x>>2];t=u^c[x+4>>2];x=h+72|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,16)|0;x=10256+((u&255)<<3)|0;u=y^c[x>>2];y=t^c[x+4>>2];x=h+88|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,8)|0;x=12304+((t&255)<<3)|0;t=14352+((c[h+104>>2]&255)<<3)|0;w=y^c[x+4>>2]^c[t+4>>2];y=l+56|0;c[y>>2]=u^c[x>>2]^c[t>>2];c[y+4>>2]=w;w=h+72|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,56)|0;w=16+(y<<3)|0;y=c[w>>2]|0;t=c[w+4>>2]|0;w=h+88|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,48)|0;w=2064+((x&255)<<3)|0;x=y^c[w>>2];y=t^c[w+4>>2];w=h+104|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,40)|0;w=4112+((t&255)<<3)|0;t=6160+((c[h+28>>2]&255)<<3)|0;u=x^c[w>>2]^c[t>>2];x=y^c[w+4>>2]^c[t+4>>2];t=h+64|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((w&255)<<3)|0;w=u^c[t>>2];u=x^c[t+4>>2];t=h+80|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((x&255)<<3)|0;x=w^c[t>>2];w=u^c[t+4>>2];t=h+96|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((u&255)<<3)|0;u=14352+((c[h+112>>2]&255)<<3)|0;y=w^c[t+4>>2]^c[u+4>>2];w=l+64|0;c[w>>2]=x^c[t>>2]^c[u>>2];c[w+4>>2]=y;y=h+80|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(w<<3)|0;w=c[y>>2]|0;u=c[y+4>>2]|0;y=h+96|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((t&255)<<3)|0;t=w^c[y>>2];w=u^c[y+4>>2];y=h+112|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((u&255)<<3)|0;u=6160+((c[h+36>>2]&255)<<3)|0;x=t^c[y>>2]^c[u>>2];t=w^c[y+4>>2]^c[u+4>>2];u=h+72|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,24)|0;u=8208+((y&255)<<3)|0;y=x^c[u>>2];x=t^c[u+4>>2];u=h+88|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,16)|0;u=10256+((t&255)<<3)|0;t=y^c[u>>2];y=x^c[u+4>>2];u=h+104|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,8)|0;u=12304+((x&255)<<3)|0;x=14352+((c[h+120>>2]&255)<<3)|0;w=y^c[u+4>>2]^c[x+4>>2];y=l+72|0;c[y>>2]=t^c[u>>2]^c[x>>2];c[y+4>>2]=w;w=h+88|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,56)|0;w=16+(y<<3)|0;y=c[w>>2]|0;x=c[w+4>>2]|0;w=h+104|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,48)|0;w=2064+((u&255)<<3)|0;u=y^c[w>>2];y=x^c[w+4>>2];w=h+120|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,40)|0;w=4112+((x&255)<<3)|0;x=6160+((c[h+44>>2]&255)<<3)|0;t=u^c[w>>2]^c[x>>2];u=y^c[w+4>>2]^c[x+4>>2];x=h+80|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,24)|0;x=8208+((w&255)<<3)|0;w=t^c[x>>2];t=u^c[x+4>>2];x=h+96|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,16)|0;x=10256+((u&255)<<3)|0;u=w^c[x>>2];w=t^c[x+4>>2];x=h+112|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,8)|0;x=12304+((t&255)<<3)|0;t=14352+((c[h>>2]&255)<<3)|0;y=w^c[x+4>>2]^c[t+4>>2];w=l+80|0;c[w>>2]=u^c[x>>2]^c[t>>2];c[w+4>>2]=y;y=h+96|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(w<<3)|0;w=c[y>>2]|0;t=c[y+4>>2]|0;y=h+112|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((x&255)<<3)|0;x=w^c[y>>2];w=t^c[y+4>>2];y=h;t=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((t&255)<<3)|0;t=6160+((c[h+52>>2]&255)<<3)|0;u=x^c[y>>2]^c[t>>2];x=w^c[y+4>>2]^c[t+4>>2];t=h+88|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((y&255)<<3)|0;y=u^c[t>>2];u=x^c[t+4>>2];t=h+104|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((x&255)<<3)|0;x=y^c[t>>2];y=u^c[t+4>>2];t=h+120|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((u&255)<<3)|0;u=14352+((c[h+8>>2]&255)<<3)|0;w=y^c[t+4>>2]^c[u+4>>2];y=l+88|0;c[y>>2]=x^c[t>>2]^c[u>>2];c[y+4>>2]=w;w=h+104|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,56)|0;w=16+(y<<3)|0;y=c[w>>2]|0;u=c[w+4>>2]|0;w=h+120|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,48)|0;w=2064+((t&255)<<3)|0;t=y^c[w>>2];y=u^c[w+4>>2];w=h+8|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,40)|0;w=4112+((u&255)<<3)|0;u=6160+((c[h+60>>2]&255)<<3)|0;x=t^c[w>>2]^c[u>>2];t=y^c[w+4>>2]^c[u+4>>2];u=h+96|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,24)|0;u=8208+((w&255)<<3)|0;w=x^c[u>>2];x=t^c[u+4>>2];u=h+112|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,16)|0;u=10256+((t&255)<<3)|0;t=w^c[u>>2];w=x^c[u+4>>2];u=h;x=Ua(c[u>>2]|0,c[u+4>>2]|0,8)|0;u=12304+((x&255)<<3)|0;x=14352+((c[h+16>>2]&255)<<3)|0;y=w^c[u+4>>2]^c[x+4>>2];w=l+96|0;c[w>>2]=t^c[u>>2]^c[x>>2];c[w+4>>2]=y;y=h+112|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(w<<3)|0;w=c[y>>2]|0;x=c[y+4>>2]|0;y=h;u=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((u&255)<<3)|0;u=w^c[y>>2];w=x^c[y+4>>2];y=h+16|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((x&255)<<3)|0;x=6160+((c[h+68>>2]&255)<<3)|0;t=u^c[y>>2]^c[x>>2];u=w^c[y+4>>2]^c[x+4>>2];x=h+104|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,24)|0;x=8208+((y&255)<<3)|0;y=t^c[x>>2];t=u^c[x+4>>2];x=h+120|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,16)|0;x=10256+((u&255)<<3)|0;u=y^c[x>>2];y=t^c[x+4>>2];x=h+8|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,8)|0;x=12304+((t&255)<<3)|0;t=14352+((c[h+24>>2]&255)<<3)|0;w=y^c[x+4>>2]^c[t+4>>2];y=l+104|0;c[y>>2]=u^c[x>>2]^c[t>>2];c[y+4>>2]=w;w=h+120|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,56)|0;w=16+(y<<3)|0;y=c[w>>2]|0;t=c[w+4>>2]|0;w=h+8|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,48)|0;w=2064+((x&255)<<3)|0;x=y^c[w>>2];y=t^c[w+4>>2];w=h+24|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,40)|0;w=4112+((t&255)<<3)|0;t=6160+((c[h+76>>2]&255)<<3)|0;u=x^c[w>>2]^c[t>>2];x=y^c[w+4>>2]^c[t+4>>2];t=h+112|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((w&255)<<3)|0;w=u^c[t>>2];u=x^c[t+4>>2];t=h;x=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((x&255)<<3)|0;x=w^c[t>>2];w=u^c[t+4>>2];t=h+16|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((u&255)<<3)|0;u=14352+((c[h+32>>2]&255)<<3)|0;y=w^c[t+4>>2]^c[u+4>>2];w=l+112|0;c[w>>2]=x^c[t>>2]^c[u>>2];c[w+4>>2]=y;y=h;w=Ua(c[y>>2]|0,c[y+4>>2]|0,56)|0;y=16+(w<<3)|0;w=c[y>>2]|0;u=c[y+4>>2]|0;y=h+16|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,48)|0;y=2064+((t&255)<<3)|0;t=w^c[y>>2];w=u^c[y+4>>2];y=h+32|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,40)|0;y=4112+((u&255)<<3)|0;u=6160+((c[h+84>>2]&255)<<3)|0;x=t^c[y>>2]^c[u>>2];t=w^c[y+4>>2]^c[u+4>>2];u=h+120|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,24)|0;u=8208+((y&255)<<3)|0;y=x^c[u>>2];x=t^c[u+4>>2];u=h+8|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,16)|0;u=10256+((t&255)<<3)|0;t=y^c[u>>2];y=x^c[u+4>>2];u=h+24|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,8)|0;u=12304+((x&255)<<3)|0;x=14352+((c[h+40>>2]&255)<<3)|0;w=y^c[u+4>>2]^c[x+4>>2];y=l+120|0;c[y>>2]=t^c[u>>2]^c[x>>2];c[y+4>>2]=w;w=l;y=c[w+4>>2]|0;x=h;c[x>>2]=c[w>>2];c[x+4>>2]=y;y=l+8|0;x=c[y+4>>2]|0;w=h+8|0;c[w>>2]=c[y>>2];c[w+4>>2]=x;x=l+16|0;w=c[x+4>>2]|0;y=h+16|0;c[y>>2]=c[x>>2];c[y+4>>2]=w;w=l+24|0;y=c[w+4>>2]|0;x=h+24|0;c[x>>2]=c[w>>2];c[x+4>>2]=y;y=l+32|0;x=c[y+4>>2]|0;w=h+32|0;c[w>>2]=c[y>>2];c[w+4>>2]=x;x=l+40|0;w=c[x+4>>2]|0;y=h+40|0;c[y>>2]=c[x>>2];c[y+4>>2]=w;w=l+48|0;y=c[w+4>>2]|0;x=h+48|0;c[x>>2]=c[w>>2];c[x+4>>2]=y;y=l+56|0;x=c[y+4>>2]|0;w=h+56|0;c[w>>2]=c[y>>2];c[w+4>>2]=x;x=l+64|0;w=c[x+4>>2]|0;y=h+64|0;c[y>>2]=c[x>>2];c[y+4>>2]=w;w=l+72|0;y=c[w+4>>2]|0;x=h+72|0;c[x>>2]=c[w>>2];c[x+4>>2]=y;y=l+80|0;x=c[y+4>>2]|0;w=h+80|0;c[w>>2]=c[y>>2];c[w+4>>2]=x;x=l+88|0;w=c[x+4>>2]|0;y=h+88|0;c[y>>2]=c[x>>2];c[y+4>>2]=w;w=l+96|0;y=c[w+4>>2]|0;x=h+96|0;c[x>>2]=c[w>>2];c[x+4>>2]=y;y=l+104|0;x=c[y+4>>2]|0;w=h+104|0;c[w>>2]=c[y>>2];c[w+4>>2]=x;x=l+112|0;w=c[x+4>>2]|0;y=h+112|0;c[y>>2]=c[x>>2];c[y+4>>2]=w;w=l+120|0;y=c[w+4>>2]|0;x=h+120|0;c[x>>2]=c[w>>2];c[x+4>>2]=y;y=v+1|0;x=h;w=x;u=c[w+4>>2]^~(((y|0)<0)<<31>>31);t=x;c[t>>2]=c[w>>2]^~y;c[t+4>>2]=u;u=v+1|0;t=h+8|0;y=t;w=c[y+4>>2]^~(((u|0)<0)<<31>>31);x=t;c[x>>2]=c[y>>2]^(u^-17);c[x+4>>2]=w;w=v+1|0;x=h+16|0;u=x;y=c[u+4>>2]^~(((w|0)<0)<<31>>31);t=x;c[t>>2]=c[u>>2]^(w^-33);c[t+4>>2]=y;y=v+1|0;t=h+24|0;w=t;u=c[w+4>>2]^~(((y|0)<0)<<31>>31);x=t;c[x>>2]=c[w>>2]^(y^-49);c[x+4>>2]=u;u=v+1|0;x=h+32|0;y=x;w=c[y+4>>2]^~(((u|0)<0)<<31>>31);t=x;c[t>>2]=c[y>>2]^(u^-65);c[t+4>>2]=w;w=v+1|0;t=h+40|0;u=t;y=c[u+4>>2]^~(((w|0)<0)<<31>>31);x=t;c[x>>2]=c[u>>2]^(w^-81);c[x+4>>2]=y;y=v+1|0;x=h+48|0;w=x;u=c[w+4>>2]^~(((y|0)<0)<<31>>31);t=x;c[t>>2]=c[w>>2]^(y^-97);c[t+4>>2]=u;u=v+1|0;t=h+56|0;y=t;w=c[y+4>>2]^~(((u|0)<0)<<31>>31);x=t;c[x>>2]=c[y>>2]^(u^-113);c[x+4>>2]=w;w=v+1|0;x=h+64|0;u=x;y=c[u+4>>2]^~(((w|0)<0)<<31>>31);t=x;c[t>>2]=c[u>>2]^(w^-129);c[t+4>>2]=y;y=v+1|0;t=h+72|0;w=t;u=c[w+4>>2]^~(((y|0)<0)<<31>>31);x=t;c[x>>2]=c[w>>2]^(y^-145);c[x+4>>2]=u;u=v+1|0;x=h+80|0;y=x;w=c[y+4>>2]^~(((u|0)<0)<<31>>31);t=x;c[t>>2]=c[y>>2]^(u^-161);c[t+4>>2]=w;w=v+1|0;t=h+88|0;u=t;y=c[u+4>>2]^~(((w|0)<0)<<31>>31);x=t;c[x>>2]=c[u>>2]^(w^-177);c[x+4>>2]=y;y=v+1|0;x=h+96|0;w=x;u=c[w+4>>2]^~(((y|0)<0)<<31>>31);t=x;c[t>>2]=c[w>>2]^(y^-193);c[t+4>>2]=u;u=v+1|0;t=h+104|0;y=t;w=c[y+4>>2]^~(((u|0)<0)<<31>>31);x=t;c[x>>2]=c[y>>2]^(u^-209);c[x+4>>2]=w;w=v+1|0;x=h+112|0;u=x;y=c[u+4>>2]^~(((w|0)<0)<<31>>31);t=x;c[t>>2]=c[u>>2]^(w^-225);c[t+4>>2]=y;y=v+1|0;t=h+120|0;w=t;u=c[w+4>>2]^~(((y|0)<0)<<31>>31);x=t;c[x>>2]=c[w>>2]^(y^-241);c[x+4>>2]=u;u=h+8|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(x<<3)|0;x=c[u>>2]|0;y=c[u+4>>2]|0;u=h+24|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((w&255)<<3)|0;w=x^c[u>>2];x=y^c[u+4>>2];u=h+40|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((y&255)<<3)|0;y=6160+((c[h+92>>2]&255)<<3)|0;t=w^c[u>>2]^c[y>>2];w=x^c[u+4>>2]^c[y+4>>2];y=h;u=Ua(c[y>>2]|0,c[y+4>>2]|0,24)|0;y=8208+((u&255)<<3)|0;u=t^c[y>>2];t=w^c[y+4>>2];y=h+16|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,16)|0;y=10256+((w&255)<<3)|0;w=u^c[y>>2];u=t^c[y+4>>2];y=h+32|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,8)|0;y=12304+((t&255)<<3)|0;t=14352+((c[h+48>>2]&255)<<3)|0;x=u^c[y+4>>2]^c[t+4>>2];u=m;c[u>>2]=w^c[y>>2]^c[t>>2];c[u+4>>2]=x;x=h+16|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(u<<3)|0;u=c[x>>2]|0;t=c[x+4>>2]|0;x=h+32|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((y&255)<<3)|0;y=u^c[x>>2];u=t^c[x+4>>2];x=h+48|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((t&255)<<3)|0;t=6160+((c[h+100>>2]&255)<<3)|0;w=y^c[x>>2]^c[t>>2];y=u^c[x+4>>2]^c[t+4>>2];t=h+8|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((x&255)<<3)|0;x=w^c[t>>2];w=y^c[t+4>>2];t=h+24|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((y&255)<<3)|0;y=x^c[t>>2];x=w^c[t+4>>2];t=h+40|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((w&255)<<3)|0;w=14352+((c[h+56>>2]&255)<<3)|0;u=x^c[t+4>>2]^c[w+4>>2];x=m+8|0;c[x>>2]=y^c[t>>2]^c[w>>2];c[x+4>>2]=u;u=h+24|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(x<<3)|0;x=c[u>>2]|0;w=c[u+4>>2]|0;u=h+40|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((t&255)<<3)|0;t=x^c[u>>2];x=w^c[u+4>>2];u=h+56|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((w&255)<<3)|0;w=6160+((c[h+108>>2]&255)<<3)|0;y=t^c[u>>2]^c[w>>2];t=x^c[u+4>>2]^c[w+4>>2];w=h+16|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((u&255)<<3)|0;u=y^c[w>>2];y=t^c[w+4>>2];w=h+32|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((t&255)<<3)|0;t=u^c[w>>2];u=y^c[w+4>>2];w=h+48|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((y&255)<<3)|0;y=14352+((c[h+64>>2]&255)<<3)|0;x=u^c[w+4>>2]^c[y+4>>2];u=m+16|0;c[u>>2]=t^c[w>>2]^c[y>>2];c[u+4>>2]=x;x=h+32|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(u<<3)|0;u=c[x>>2]|0;y=c[x+4>>2]|0;x=h+48|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((w&255)<<3)|0;w=u^c[x>>2];u=y^c[x+4>>2];x=h+64|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((y&255)<<3)|0;y=6160+((c[h+116>>2]&255)<<3)|0;t=w^c[x>>2]^c[y>>2];w=u^c[x+4>>2]^c[y+4>>2];y=h+24|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,24)|0;y=8208+((x&255)<<3)|0;x=t^c[y>>2];t=w^c[y+4>>2];y=h+40|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,16)|0;y=10256+((w&255)<<3)|0;w=x^c[y>>2];x=t^c[y+4>>2];y=h+56|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,8)|0;y=12304+((t&255)<<3)|0;t=14352+((c[h+72>>2]&255)<<3)|0;u=x^c[y+4>>2]^c[t+4>>2];x=m+24|0;c[x>>2]=w^c[y>>2]^c[t>>2];c[x+4>>2]=u;u=h+40|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(x<<3)|0;x=c[u>>2]|0;t=c[u+4>>2]|0;u=h+56|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((y&255)<<3)|0;y=x^c[u>>2];x=t^c[u+4>>2];u=h+72|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((t&255)<<3)|0;t=6160+((c[h+124>>2]&255)<<3)|0;w=y^c[u>>2]^c[t>>2];y=x^c[u+4>>2]^c[t+4>>2];t=h+32|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((u&255)<<3)|0;u=w^c[t>>2];w=y^c[t+4>>2];t=h+48|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((y&255)<<3)|0;y=u^c[t>>2];u=w^c[t+4>>2];t=h+64|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((w&255)<<3)|0;w=14352+((c[h+80>>2]&255)<<3)|0;x=u^c[t+4>>2]^c[w+4>>2];u=m+32|0;c[u>>2]=y^c[t>>2]^c[w>>2];c[u+4>>2]=x;x=h+48|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(u<<3)|0;u=c[x>>2]|0;w=c[x+4>>2]|0;x=h+64|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((t&255)<<3)|0;t=u^c[x>>2];u=w^c[x+4>>2];x=h+80|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((w&255)<<3)|0;w=6160+((c[h+4>>2]&255)<<3)|0;y=t^c[x>>2]^c[w>>2];t=u^c[x+4>>2]^c[w+4>>2];w=h+40|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((x&255)<<3)|0;x=y^c[w>>2];y=t^c[w+4>>2];w=h+56|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((t&255)<<3)|0;t=x^c[w>>2];x=y^c[w+4>>2];w=h+72|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((y&255)<<3)|0;y=14352+((c[h+88>>2]&255)<<3)|0;u=x^c[w+4>>2]^c[y+4>>2];x=m+40|0;c[x>>2]=t^c[w>>2]^c[y>>2];c[x+4>>2]=u;u=h+56|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(x<<3)|0;x=c[u>>2]|0;y=c[u+4>>2]|0;u=h+72|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((w&255)<<3)|0;w=x^c[u>>2];x=y^c[u+4>>2];u=h+88|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((y&255)<<3)|0;y=6160+((c[h+12>>2]&255)<<3)|0;t=w^c[u>>2]^c[y>>2];w=x^c[u+4>>2]^c[y+4>>2];y=h+48|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,24)|0;y=8208+((u&255)<<3)|0;u=t^c[y>>2];t=w^c[y+4>>2];y=h+64|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,16)|0;y=10256+((w&255)<<3)|0;w=u^c[y>>2];u=t^c[y+4>>2];y=h+80|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,8)|0;y=12304+((t&255)<<3)|0;t=14352+((c[h+96>>2]&255)<<3)|0;x=u^c[y+4>>2]^c[t+4>>2];u=m+48|0;c[u>>2]=w^c[y>>2]^c[t>>2];c[u+4>>2]=x;x=h+64|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(u<<3)|0;u=c[x>>2]|0;t=c[x+4>>2]|0;x=h+80|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((y&255)<<3)|0;y=u^c[x>>2];u=t^c[x+4>>2];x=h+96|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((t&255)<<3)|0;t=6160+((c[h+20>>2]&255)<<3)|0;w=y^c[x>>2]^c[t>>2];y=u^c[x+4>>2]^c[t+4>>2];t=h+56|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((x&255)<<3)|0;x=w^c[t>>2];w=y^c[t+4>>2];t=h+72|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((y&255)<<3)|0;y=x^c[t>>2];x=w^c[t+4>>2];t=h+88|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((w&255)<<3)|0;w=14352+((c[h+104>>2]&255)<<3)|0;u=x^c[t+4>>2]^c[w+4>>2];x=m+56|0;c[x>>2]=y^c[t>>2]^c[w>>2];c[x+4>>2]=u;u=h+72|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(x<<3)|0;x=c[u>>2]|0;w=c[u+4>>2]|0;u=h+88|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((t&255)<<3)|0;t=x^c[u>>2];x=w^c[u+4>>2];u=h+104|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((w&255)<<3)|0;w=6160+((c[h+28>>2]&255)<<3)|0;y=t^c[u>>2]^c[w>>2];t=x^c[u+4>>2]^c[w+4>>2];w=h+64|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((u&255)<<3)|0;u=y^c[w>>2];y=t^c[w+4>>2];w=h+80|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((t&255)<<3)|0;t=u^c[w>>2];u=y^c[w+4>>2];w=h+96|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((y&255)<<3)|0;y=14352+((c[h+112>>2]&255)<<3)|0;x=u^c[w+4>>2]^c[y+4>>2];u=m+64|0;c[u>>2]=t^c[w>>2]^c[y>>2];c[u+4>>2]=x;x=h+80|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(u<<3)|0;u=c[x>>2]|0;y=c[x+4>>2]|0;x=h+96|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((w&255)<<3)|0;w=u^c[x>>2];u=y^c[x+4>>2];x=h+112|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((y&255)<<3)|0;y=6160+((c[h+36>>2]&255)<<3)|0;t=w^c[x>>2]^c[y>>2];w=u^c[x+4>>2]^c[y+4>>2];y=h+72|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,24)|0;y=8208+((x&255)<<3)|0;x=t^c[y>>2];t=w^c[y+4>>2];y=h+88|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,16)|0;y=10256+((w&255)<<3)|0;w=x^c[y>>2];x=t^c[y+4>>2];y=h+104|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,8)|0;y=12304+((t&255)<<3)|0;t=14352+((c[h+120>>2]&255)<<3)|0;u=x^c[y+4>>2]^c[t+4>>2];x=m+72|0;c[x>>2]=w^c[y>>2]^c[t>>2];c[x+4>>2]=u;u=h+88|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(x<<3)|0;x=c[u>>2]|0;t=c[u+4>>2]|0;u=h+104|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((y&255)<<3)|0;y=x^c[u>>2];x=t^c[u+4>>2];u=h+120|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((t&255)<<3)|0;t=6160+((c[h+44>>2]&255)<<3)|0;w=y^c[u>>2]^c[t>>2];y=x^c[u+4>>2]^c[t+4>>2];t=h+80|0;u=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((u&255)<<3)|0;u=w^c[t>>2];w=y^c[t+4>>2];t=h+96|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((y&255)<<3)|0;y=u^c[t>>2];u=w^c[t+4>>2];t=h+112|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((w&255)<<3)|0;w=14352+((c[h>>2]&255)<<3)|0;x=u^c[t+4>>2]^c[w+4>>2];u=m+80|0;c[u>>2]=y^c[t>>2]^c[w>>2];c[u+4>>2]=x;x=h+96|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(u<<3)|0;u=c[x>>2]|0;w=c[x+4>>2]|0;x=h+112|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((t&255)<<3)|0;t=u^c[x>>2];u=w^c[x+4>>2];x=h;w=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((w&255)<<3)|0;w=6160+((c[h+52>>2]&255)<<3)|0;y=t^c[x>>2]^c[w>>2];t=u^c[x+4>>2]^c[w+4>>2];w=h+88|0;x=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((x&255)<<3)|0;x=y^c[w>>2];y=t^c[w+4>>2];w=h+104|0;t=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((t&255)<<3)|0;t=x^c[w>>2];x=y^c[w+4>>2];w=h+120|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((y&255)<<3)|0;y=14352+((c[h+8>>2]&255)<<3)|0;u=x^c[w+4>>2]^c[y+4>>2];x=m+88|0;c[x>>2]=t^c[w>>2]^c[y>>2];c[x+4>>2]=u;u=h+104|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(x<<3)|0;x=c[u>>2]|0;y=c[u+4>>2]|0;u=h+120|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((w&255)<<3)|0;w=x^c[u>>2];x=y^c[u+4>>2];u=h+8|0;y=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((y&255)<<3)|0;y=6160+((c[h+60>>2]&255)<<3)|0;t=w^c[u>>2]^c[y>>2];w=x^c[u+4>>2]^c[y+4>>2];y=h+96|0;u=Ua(c[y>>2]|0,c[y+4>>2]|0,24)|0;y=8208+((u&255)<<3)|0;u=t^c[y>>2];t=w^c[y+4>>2];y=h+112|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,16)|0;y=10256+((w&255)<<3)|0;w=u^c[y>>2];u=t^c[y+4>>2];y=h;t=Ua(c[y>>2]|0,c[y+4>>2]|0,8)|0;y=12304+((t&255)<<3)|0;t=14352+((c[h+16>>2]&255)<<3)|0;x=u^c[y+4>>2]^c[t+4>>2];u=m+96|0;c[u>>2]=w^c[y>>2]^c[t>>2];c[u+4>>2]=x;x=h+112|0;u=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(u<<3)|0;u=c[x>>2]|0;t=c[x+4>>2]|0;x=h;y=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((y&255)<<3)|0;y=u^c[x>>2];u=t^c[x+4>>2];x=h+16|0;t=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((t&255)<<3)|0;t=6160+((c[h+68>>2]&255)<<3)|0;w=y^c[x>>2]^c[t>>2];y=u^c[x+4>>2]^c[t+4>>2];t=h+104|0;x=Ua(c[t>>2]|0,c[t+4>>2]|0,24)|0;t=8208+((x&255)<<3)|0;x=w^c[t>>2];w=y^c[t+4>>2];t=h+120|0;y=Ua(c[t>>2]|0,c[t+4>>2]|0,16)|0;t=10256+((y&255)<<3)|0;y=x^c[t>>2];x=w^c[t+4>>2];t=h+8|0;w=Ua(c[t>>2]|0,c[t+4>>2]|0,8)|0;t=12304+((w&255)<<3)|0;w=14352+((c[h+24>>2]&255)<<3)|0;u=x^c[t+4>>2]^c[w+4>>2];x=m+104|0;c[x>>2]=y^c[t>>2]^c[w>>2];c[x+4>>2]=u;u=h+120|0;x=Ua(c[u>>2]|0,c[u+4>>2]|0,56)|0;u=16+(x<<3)|0;x=c[u>>2]|0;w=c[u+4>>2]|0;u=h+8|0;t=Ua(c[u>>2]|0,c[u+4>>2]|0,48)|0;u=2064+((t&255)<<3)|0;t=x^c[u>>2];x=w^c[u+4>>2];u=h+24|0;w=Ua(c[u>>2]|0,c[u+4>>2]|0,40)|0;u=4112+((w&255)<<3)|0;w=6160+((c[h+76>>2]&255)<<3)|0;y=t^c[u>>2]^c[w>>2];t=x^c[u+4>>2]^c[w+4>>2];w=h+112|0;u=Ua(c[w>>2]|0,c[w+4>>2]|0,24)|0;w=8208+((u&255)<<3)|0;u=y^c[w>>2];y=t^c[w+4>>2];w=h;t=Ua(c[w>>2]|0,c[w+4>>2]|0,16)|0;w=10256+((t&255)<<3)|0;t=u^c[w>>2];u=y^c[w+4>>2];w=h+16|0;y=Ua(c[w>>2]|0,c[w+4>>2]|0,8)|0;w=12304+((y&255)<<3)|0;y=14352+((c[h+32>>2]&255)<<3)|0;x=u^c[w+4>>2]^c[y+4>>2];u=m+112|0;c[u>>2]=t^c[w>>2]^c[y>>2];c[u+4>>2]=x;x=h;u=Ua(c[x>>2]|0,c[x+4>>2]|0,56)|0;x=16+(u<<3)|0;u=c[x>>2]|0;y=c[x+4>>2]|0;x=h+16|0;w=Ua(c[x>>2]|0,c[x+4>>2]|0,48)|0;x=2064+((w&255)<<3)|0;w=u^c[x>>2];u=y^c[x+4>>2];x=h+32|0;y=Ua(c[x>>2]|0,c[x+4>>2]|0,40)|0;x=4112+((y&255)<<3)|0;y=6160+((c[h+84>>2]&255)<<3)|0;t=w^c[x>>2]^c[y>>2];w=u^c[x+4>>2]^c[y+4>>2];y=h+120|0;x=Ua(c[y>>2]|0,c[y+4>>2]|0,24)|0;y=8208+((x&255)<<3)|0;x=t^c[y>>2];t=w^c[y+4>>2];y=h+8|0;w=Ua(c[y>>2]|0,c[y+4>>2]|0,16)|0;y=10256+((w&255)<<3)|0;w=x^c[y>>2];x=t^c[y+4>>2];y=h+24|0;t=Ua(c[y>>2]|0,c[y+4>>2]|0,8)|0;y=12304+((t&255)<<3)|0;t=14352+((c[h+40>>2]&255)<<3)|0;u=x^c[y+4>>2]^c[t+4>>2];x=m+120|0;c[x>>2]=w^c[y>>2]^c[t>>2];c[x+4>>2]=u;u=m;x=c[u+4>>2]|0;t=h;c[t>>2]=c[u>>2];c[t+4>>2]=x;x=m+8|0;t=c[x+4>>2]|0;u=h+8|0;c[u>>2]=c[x>>2];c[u+4>>2]=t;t=m+16|0;u=c[t+4>>2]|0;x=h+16|0;c[x>>2]=c[t>>2];c[x+4>>2]=u;u=m+24|0;x=c[u+4>>2]|0;t=h+24|0;c[t>>2]=c[u>>2];c[t+4>>2]=x;x=m+32|0;t=c[x+4>>2]|0;u=h+32|0;c[u>>2]=c[x>>2];c[u+4>>2]=t;t=m+40|0;u=c[t+4>>2]|0;x=h+40|0;c[x>>2]=c[t>>2];c[x+4>>2]=u;u=m+48|0;x=c[u+4>>2]|0;t=h+48|0;c[t>>2]=c[u>>2];c[t+4>>2]=x;x=m+56|0;t=c[x+4>>2]|0;u=h+56|0;c[u>>2]=c[x>>2];c[u+4>>2]=t;t=m+64|0;u=c[t+4>>2]|0;x=h+64|0;c[x>>2]=c[t>>2];c[x+4>>2]=u;u=m+72|0;x=c[u+4>>2]|0;t=h+72|0;c[t>>2]=c[u>>2];c[t+4>>2]=x;x=m+80|0;t=c[x+4>>2]|0;u=h+80|0;c[u>>2]=c[x>>2];c[u+4>>2]=t;t=m+88|0;u=c[t+4>>2]|0;x=h+88|0;c[x>>2]=c[t>>2];c[x+4>>2]=u;u=m+96|0;x=c[u+4>>2]|0;t=h+96|0;c[t>>2]=c[u>>2];c[t+4>>2]=x;x=m+104|0;t=c[x+4>>2]|0;u=h+104|0;c[u>>2]=c[x>>2];c[u+4>>2]=t;t=m+112|0;u=c[t+4>>2]|0;x=h+112|0;c[x>>2]=c[t>>2];c[x+4>>2]=u;u=m+120|0;x=c[u+4>>2]|0;t=h+120|0;c[t>>2]=c[u>>2];c[t+4>>2]=x;v=v+2|0}s=0;while(1){if(!(s>>>0<16)){break}v=g+(s<<3)|0;x=h+(s<<3)|0;t=f+(s<<3)|0;u=t;y=c[u+4>>2]^(c[v+4>>2]^c[x+4>>2]);w=t;c[w>>2]=c[u>>2]^(c[v>>2]^c[x>>2]);c[w+4>>2]=y;s=s+1|0}s=n+264|0;y=s;w=Sa(c[y>>2]|0,c[y+4>>2]|0,1,0)|0;y=s;c[y>>2]=w;c[y+4>>2]=D;o=0}p=n+136|0;q=f+0|0;r=p+128|0;do{c[p>>2]=c[q>>2];p=p+4|0;q=q+4|0}while((p|0)<(r|0));c[n+128>>2]=o;i=e;return}



    function Ja(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;h=i;i=i+752|0;j=h+48|0;k=h+208|0;l=h+224|0;m=h+352|0;n=h+496|0;o=h+624|0;p=b;b=f;f=g;g=c[p+128>>2]|0;q=128>>e;a[j]=(d&0-q|q)&255;q=g;if(g>>>0<120){r=128-q|0;g=p+264|0;d=Sa(c[g>>2]|0,c[g+4>>2]|0,1,0)|0;g=k;c[g>>2]=d;c[g+4>>2]=D}else{r=256-q|0;q=p+264|0;g=Sa(c[q>>2]|0,c[q+4>>2]|0,2,0)|0;q=k;c[q>>2]=g;c[q+4>>2]=D}Ta(j+1|0,0,r-9|0)|0;q=k;Na(j+r+ -8|0,c[q>>2]|0,c[q+4>>2]|0);Ia(p,j,r);r=l+0|0;q=p+136|0;k=r+128|0;do{c[r>>2]=c[q>>2];r=r+4|0;q=q+4|0}while((r|0)<(k|0));r=m+0|0;q=l+0|0;k=r+128|0;do{c[r>>2]=c[q>>2];r=r+4|0;q=q+4|0}while((r|0)<(k|0));q=0;while(1){if((q|0)>=14){break}r=q+0|0;k=Va(r|0,((r|0)<0)<<31>>31|0,56)|0;r=m;g=r;d=c[g+4>>2]^D;e=r;c[e>>2]=c[g>>2]^k;c[e+4>>2]=d;d=q+16|0;e=Va(d|0,((d|0)<0)<<31>>31|0,56)|0;d=m+8|0;k=d;g=c[k+4>>2]^D;r=d;c[r>>2]=c[k>>2]^e;c[r+4>>2]=g;g=q+32|0;r=Va(g|0,((g|0)<0)<<31>>31|0,56)|0;g=m+16|0;e=g;k=c[e+4>>2]^D;d=g;c[d>>2]=c[e>>2]^r;c[d+4>>2]=k;k=q+48|0;d=Va(k|0,((k|0)<0)<<31>>31|0,56)|0;k=m+24|0;r=k;e=c[r+4>>2]^D;g=k;c[g>>2]=c[r>>2]^d;c[g+4>>2]=e;e=q+64|0;g=Va(e|0,((e|0)<0)<<31>>31|0,56)|0;e=m+32|0;d=e;r=c[d+4>>2]^D;k=e;c[k>>2]=c[d>>2]^g;c[k+4>>2]=r;r=q+80|0;k=Va(r|0,((r|0)<0)<<31>>31|0,56)|0;r=m+40|0;g=r;d=c[g+4>>2]^D;e=r;c[e>>2]=c[g>>2]^k;c[e+4>>2]=d;d=q+96|0;e=Va(d|0,((d|0)<0)<<31>>31|0,56)|0;d=m+48|0;k=d;g=c[k+4>>2]^D;r=d;c[r>>2]=c[k>>2]^e;c[r+4>>2]=g;g=q+112|0;r=Va(g|0,((g|0)<0)<<31>>31|0,56)|0;g=m+56|0;e=g;k=c[e+4>>2]^D;d=g;c[d>>2]=c[e>>2]^r;c[d+4>>2]=k;k=q+128|0;d=Va(k|0,((k|0)<0)<<31>>31|0,56)|0;k=m+64|0;r=k;e=c[r+4>>2]^D;g=k;c[g>>2]=c[r>>2]^d;c[g+4>>2]=e;e=q+144|0;g=Va(e|0,((e|0)<0)<<31>>31|0,56)|0;e=m+72|0;d=e;r=c[d+4>>2]^D;k=e;c[k>>2]=c[d>>2]^g;c[k+4>>2]=r;r=q+160|0;k=Va(r|0,((r|0)<0)<<31>>31|0,56)|0;r=m+80|0;g=r;d=c[g+4>>2]^D;e=r;c[e>>2]=c[g>>2]^k;c[e+4>>2]=d;d=q+176|0;e=Va(d|0,((d|0)<0)<<31>>31|0,56)|0;d=m+88|0;k=d;g=c[k+4>>2]^D;r=d;c[r>>2]=c[k>>2]^e;c[r+4>>2]=g;g=q+192|0;r=Va(g|0,((g|0)<0)<<31>>31|0,56)|0;g=m+96|0;e=g;k=c[e+4>>2]^D;d=g;c[d>>2]=c[e>>2]^r;c[d+4>>2]=k;k=q+208|0;d=Va(k|0,((k|0)<0)<<31>>31|0,56)|0;k=m+104|0;r=k;e=c[r+4>>2]^D;g=k;c[g>>2]=c[r>>2]^d;c[g+4>>2]=e;e=q+224|0;g=Va(e|0,((e|0)<0)<<31>>31|0,56)|0;e=m+112|0;d=e;r=c[d+4>>2]^D;k=e;c[k>>2]=c[d>>2]^g;c[k+4>>2]=r;r=q+240|0;k=Va(r|0,((r|0)<0)<<31>>31|0,56)|0;r=m+120|0;g=r;d=c[g+4>>2]^D;e=r;c[e>>2]=c[g>>2]^k;c[e+4>>2]=d;d=m;e=Ua(c[d>>2]|0,c[d+4>>2]|0,56)|0;d=16+(e<<3)|0;e=c[d>>2]|0;k=c[d+4>>2]|0;d=m+8|0;g=Ua(c[d>>2]|0,c[d+4>>2]|0,48)|0;d=2064+((g&255)<<3)|0;g=e^c[d>>2];e=k^c[d+4>>2];d=m+16|0;k=Ua(c[d>>2]|0,c[d+4>>2]|0,40)|0;d=4112+((k&255)<<3)|0;k=6160+((c[m+28>>2]&255)<<3)|0;r=g^c[d>>2]^c[k>>2];g=e^c[d+4>>2]^c[k+4>>2];k=m+32|0;d=Ua(c[k>>2]|0,c[k+4>>2]|0,24)|0;k=8208+((d&255)<<3)|0;d=r^c[k>>2];r=g^c[k+4>>2];k=m+40|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,16)|0;k=10256+((g&255)<<3)|0;g=d^c[k>>2];d=r^c[k+4>>2];k=m+48|0;r=Ua(c[k>>2]|0,c[k+4>>2]|0,8)|0;k=12304+((r&255)<<3)|0;r=14352+((c[m+88>>2]&255)<<3)|0;e=d^c[k+4>>2]^c[r+4>>2];d=n;c[d>>2]=g^c[k>>2]^c[r>>2];c[d+4>>2]=e;e=m+8|0;d=Ua(c[e>>2]|0,c[e+4>>2]|0,56)|0;e=16+(d<<3)|0;d=c[e>>2]|0;r=c[e+4>>2]|0;e=m+16|0;k=Ua(c[e>>2]|0,c[e+4>>2]|0,48)|0;e=2064+((k&255)<<3)|0;k=d^c[e>>2];d=r^c[e+4>>2];e=m+24|0;r=Ua(c[e>>2]|0,c[e+4>>2]|0,40)|0;e=4112+((r&255)<<3)|0;r=6160+((c[m+36>>2]&255)<<3)|0;g=k^c[e>>2]^c[r>>2];k=d^c[e+4>>2]^c[r+4>>2];r=m+40|0;e=Ua(c[r>>2]|0,c[r+4>>2]|0,24)|0;r=8208+((e&255)<<3)|0;e=g^c[r>>2];g=k^c[r+4>>2];r=m+48|0;k=Ua(c[r>>2]|0,c[r+4>>2]|0,16)|0;r=10256+((k&255)<<3)|0;k=e^c[r>>2];e=g^c[r+4>>2];r=m+56|0;g=Ua(c[r>>2]|0,c[r+4>>2]|0,8)|0;r=12304+((g&255)<<3)|0;g=14352+((c[m+96>>2]&255)<<3)|0;d=e^c[r+4>>2]^c[g+4>>2];e=n+8|0;c[e>>2]=k^c[r>>2]^c[g>>2];c[e+4>>2]=d;d=m+16|0;e=Ua(c[d>>2]|0,c[d+4>>2]|0,56)|0;d=16+(e<<3)|0;e=c[d>>2]|0;g=c[d+4>>2]|0;d=m+24|0;r=Ua(c[d>>2]|0,c[d+4>>2]|0,48)|0;d=2064+((r&255)<<3)|0;r=e^c[d>>2];e=g^c[d+4>>2];d=m+32|0;g=Ua(c[d>>2]|0,c[d+4>>2]|0,40)|0;d=4112+((g&255)<<3)|0;g=6160+((c[m+44>>2]&255)<<3)|0;k=r^c[d>>2]^c[g>>2];r=e^c[d+4>>2]^c[g+4>>2];g=m+48|0;d=Ua(c[g>>2]|0,c[g+4>>2]|0,24)|0;g=8208+((d&255)<<3)|0;d=k^c[g>>2];k=r^c[g+4>>2];g=m+56|0;r=Ua(c[g>>2]|0,c[g+4>>2]|0,16)|0;g=10256+((r&255)<<3)|0;r=d^c[g>>2];d=k^c[g+4>>2];g=m+64|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,8)|0;g=12304+((k&255)<<3)|0;k=14352+((c[m+104>>2]&255)<<3)|0;e=d^c[g+4>>2]^c[k+4>>2];d=n+16|0;c[d>>2]=r^c[g>>2]^c[k>>2];c[d+4>>2]=e;e=m+24|0;d=Ua(c[e>>2]|0,c[e+4>>2]|0,56)|0;e=16+(d<<3)|0;d=c[e>>2]|0;k=c[e+4>>2]|0;e=m+32|0;g=Ua(c[e>>2]|0,c[e+4>>2]|0,48)|0;e=2064+((g&255)<<3)|0;g=d^c[e>>2];d=k^c[e+4>>2];e=m+40|0;k=Ua(c[e>>2]|0,c[e+4>>2]|0,40)|0;e=4112+((k&255)<<3)|0;k=6160+((c[m+52>>2]&255)<<3)|0;r=g^c[e>>2]^c[k>>2];g=d^c[e+4>>2]^c[k+4>>2];k=m+56|0;e=Ua(c[k>>2]|0,c[k+4>>2]|0,24)|0;k=8208+((e&255)<<3)|0;e=r^c[k>>2];r=g^c[k+4>>2];k=m+64|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,16)|0;k=10256+((g&255)<<3)|0;g=e^c[k>>2];e=r^c[k+4>>2];k=m+72|0;r=Ua(c[k>>2]|0,c[k+4>>2]|0,8)|0;k=12304+((r&255)<<3)|0;r=14352+((c[m+112>>2]&255)<<3)|0;d=e^c[k+4>>2]^c[r+4>>2];e=n+24|0;c[e>>2]=g^c[k>>2]^c[r>>2];c[e+4>>2]=d;d=m+32|0;e=Ua(c[d>>2]|0,c[d+4>>2]|0,56)|0;d=16+(e<<3)|0;e=c[d>>2]|0;r=c[d+4>>2]|0;d=m+40|0;k=Ua(c[d>>2]|0,c[d+4>>2]|0,48)|0;d=2064+((k&255)<<3)|0;k=e^c[d>>2];e=r^c[d+4>>2];d=m+48|0;r=Ua(c[d>>2]|0,c[d+4>>2]|0,40)|0;d=4112+((r&255)<<3)|0;r=6160+((c[m+60>>2]&255)<<3)|0;g=k^c[d>>2]^c[r>>2];k=e^c[d+4>>2]^c[r+4>>2];r=m+64|0;d=Ua(c[r>>2]|0,c[r+4>>2]|0,24)|0;r=8208+((d&255)<<3)|0;d=g^c[r>>2];g=k^c[r+4>>2];r=m+72|0;k=Ua(c[r>>2]|0,c[r+4>>2]|0,16)|0;r=10256+((k&255)<<3)|0;k=d^c[r>>2];d=g^c[r+4>>2];r=m+80|0;g=Ua(c[r>>2]|0,c[r+4>>2]|0,8)|0;r=12304+((g&255)<<3)|0;g=14352+((c[m+120>>2]&255)<<3)|0;e=d^c[r+4>>2]^c[g+4>>2];d=n+32|0;c[d>>2]=k^c[r>>2]^c[g>>2];c[d+4>>2]=e;e=m+40|0;d=Ua(c[e>>2]|0,c[e+4>>2]|0,56)|0;e=16+(d<<3)|0;d=c[e>>2]|0;g=c[e+4>>2]|0;e=m+48|0;r=Ua(c[e>>2]|0,c[e+4>>2]|0,48)|0;e=2064+((r&255)<<3)|0;r=d^c[e>>2];d=g^c[e+4>>2];e=m+56|0;g=Ua(c[e>>2]|0,c[e+4>>2]|0,40)|0;e=4112+((g&255)<<3)|0;g=6160+((c[m+68>>2]&255)<<3)|0;k=r^c[e>>2]^c[g>>2];r=d^c[e+4>>2]^c[g+4>>2];g=m+72|0;e=Ua(c[g>>2]|0,c[g+4>>2]|0,24)|0;g=8208+((e&255)<<3)|0;e=k^c[g>>2];k=r^c[g+4>>2];g=m+80|0;r=Ua(c[g>>2]|0,c[g+4>>2]|0,16)|0;g=10256+((r&255)<<3)|0;r=e^c[g>>2];e=k^c[g+4>>2];g=m+88|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,8)|0;g=12304+((k&255)<<3)|0;k=14352+((c[m>>2]&255)<<3)|0;d=e^c[g+4>>2]^c[k+4>>2];e=n+40|0;c[e>>2]=r^c[g>>2]^c[k>>2];c[e+4>>2]=d;d=m+48|0;e=Ua(c[d>>2]|0,c[d+4>>2]|0,56)|0;d=16+(e<<3)|0;e=c[d>>2]|0;k=c[d+4>>2]|0;d=m+56|0;g=Ua(c[d>>2]|0,c[d+4>>2]|0,48)|0;d=2064+((g&255)<<3)|0;g=e^c[d>>2];e=k^c[d+4>>2];d=m+64|0;k=Ua(c[d>>2]|0,c[d+4>>2]|0,40)|0;d=4112+((k&255)<<3)|0;k=6160+((c[m+76>>2]&255)<<3)|0;r=g^c[d>>2]^c[k>>2];g=e^c[d+4>>2]^c[k+4>>2];k=m+80|0;d=Ua(c[k>>2]|0,c[k+4>>2]|0,24)|0;k=8208+((d&255)<<3)|0;d=r^c[k>>2];r=g^c[k+4>>2];k=m+88|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,16)|0;k=10256+((g&255)<<3)|0;g=d^c[k>>2];d=r^c[k+4>>2];k=m+96|0;r=Ua(c[k>>2]|0,c[k+4>>2]|0,8)|0;k=12304+((r&255)<<3)|0;r=14352+((c[m+8>>2]&255)<<3)|0;e=d^c[k+4>>2]^c[r+4>>2];d=n+48|0;c[d>>2]=g^c[k>>2]^c[r>>2];c[d+4>>2]=e;e=m+56|0;d=Ua(c[e>>2]|0,c[e+4>>2]|0,56)|0;e=16+(d<<3)|0;d=c[e>>2]|0;r=c[e+4>>2]|0;e=m+64|0;k=Ua(c[e>>2]|0,c[e+4>>2]|0,48)|0;e=2064+((k&255)<<3)|0;k=d^c[e>>2];d=r^c[e+4>>2];e=m+72|0;r=Ua(c[e>>2]|0,c[e+4>>2]|0,40)|0;e=4112+((r&255)<<3)|0;r=6160+((c[m+84>>2]&255)<<3)|0;g=k^c[e>>2]^c[r>>2];k=d^c[e+4>>2]^c[r+4>>2];r=m+88|0;e=Ua(c[r>>2]|0,c[r+4>>2]|0,24)|0;r=8208+((e&255)<<3)|0;e=g^c[r>>2];g=k^c[r+4>>2];r=m+96|0;k=Ua(c[r>>2]|0,c[r+4>>2]|0,16)|0;r=10256+((k&255)<<3)|0;k=e^c[r>>2];e=g^c[r+4>>2];r=m+104|0;g=Ua(c[r>>2]|0,c[r+4>>2]|0,8)|0;r=12304+((g&255)<<3)|0;g=14352+((c[m+16>>2]&255)<<3)|0;d=e^c[r+4>>2]^c[g+4>>2];e=n+56|0;c[e>>2]=k^c[r>>2]^c[g>>2];c[e+4>>2]=d;d=m+64|0;e=Ua(c[d>>2]|0,c[d+4>>2]|0,56)|0;d=16+(e<<3)|0;e=c[d>>2]|0;g=c[d+4>>2]|0;d=m+72|0;r=Ua(c[d>>2]|0,c[d+4>>2]|0,48)|0;d=2064+((r&255)<<3)|0;r=e^c[d>>2];e=g^c[d+4>>2];d=m+80|0;g=Ua(c[d>>2]|0,c[d+4>>2]|0,40)|0;d=4112+((g&255)<<3)|0;g=6160+((c[m+92>>2]&255)<<3)|0;k=r^c[d>>2]^c[g>>2];r=e^c[d+4>>2]^c[g+4>>2];g=m+96|0;d=Ua(c[g>>2]|0,c[g+4>>2]|0,24)|0;g=8208+((d&255)<<3)|0;d=k^c[g>>2];k=r^c[g+4>>2];g=m+104|0;r=Ua(c[g>>2]|0,c[g+4>>2]|0,16)|0;g=10256+((r&255)<<3)|0;r=d^c[g>>2];d=k^c[g+4>>2];g=m+112|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,8)|0;g=12304+((k&255)<<3)|0;k=14352+((c[m+24>>2]&255)<<3)|0;e=d^c[g+4>>2]^c[k+4>>2];d=n+64|0;c[d>>2]=r^c[g>>2]^c[k>>2];c[d+4>>2]=e;e=m+72|0;d=Ua(c[e>>2]|0,c[e+4>>2]|0,56)|0;e=16+(d<<3)|0;d=c[e>>2]|0;k=c[e+4>>2]|0;e=m+80|0;g=Ua(c[e>>2]|0,c[e+4>>2]|0,48)|0;e=2064+((g&255)<<3)|0;g=d^c[e>>2];d=k^c[e+4>>2];e=m+88|0;k=Ua(c[e>>2]|0,c[e+4>>2]|0,40)|0;e=4112+((k&255)<<3)|0;k=6160+((c[m+100>>2]&255)<<3)|0;r=g^c[e>>2]^c[k>>2];g=d^c[e+4>>2]^c[k+4>>2];k=m+104|0;e=Ua(c[k>>2]|0,c[k+4>>2]|0,24)|0;k=8208+((e&255)<<3)|0;e=r^c[k>>2];r=g^c[k+4>>2];k=m+112|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,16)|0;k=10256+((g&255)<<3)|0;g=e^c[k>>2];e=r^c[k+4>>2];k=m+120|0;r=Ua(c[k>>2]|0,c[k+4>>2]|0,8)|0;k=12304+((r&255)<<3)|0;r=14352+((c[m+32>>2]&255)<<3)|0;d=e^c[k+4>>2]^c[r+4>>2];e=n+72|0;c[e>>2]=g^c[k>>2]^c[r>>2];c[e+4>>2]=d;d=m+80|0;e=Ua(c[d>>2]|0,c[d+4>>2]|0,56)|0;d=16+(e<<3)|0;e=c[d>>2]|0;r=c[d+4>>2]|0;d=m+88|0;k=Ua(c[d>>2]|0,c[d+4>>2]|0,48)|0;d=2064+((k&255)<<3)|0;k=e^c[d>>2];e=r^c[d+4>>2];d=m+96|0;r=Ua(c[d>>2]|0,c[d+4>>2]|0,40)|0;d=4112+((r&255)<<3)|0;r=6160+((c[m+108>>2]&255)<<3)|0;g=k^c[d>>2]^c[r>>2];k=e^c[d+4>>2]^c[r+4>>2];r=m+112|0;d=Ua(c[r>>2]|0,c[r+4>>2]|0,24)|0;r=8208+((d&255)<<3)|0;d=g^c[r>>2];g=k^c[r+4>>2];r=m+120|0;k=Ua(c[r>>2]|0,c[r+4>>2]|0,16)|0;r=10256+((k&255)<<3)|0;k=d^c[r>>2];d=g^c[r+4>>2];r=m;g=Ua(c[r>>2]|0,c[r+4>>2]|0,8)|0;r=12304+((g&255)<<3)|0;g=14352+((c[m+40>>2]&255)<<3)|0;e=d^c[r+4>>2]^c[g+4>>2];d=n+80|0;c[d>>2]=k^c[r>>2]^c[g>>2];c[d+4>>2]=e;e=m+88|0;d=Ua(c[e>>2]|0,c[e+4>>2]|0,56)|0;e=16+(d<<3)|0;d=c[e>>2]|0;g=c[e+4>>2]|0;e=m+96|0;r=Ua(c[e>>2]|0,c[e+4>>2]|0,48)|0;e=2064+((r&255)<<3)|0;r=d^c[e>>2];d=g^c[e+4>>2];e=m+104|0;g=Ua(c[e>>2]|0,c[e+4>>2]|0,40)|0;e=4112+((g&255)<<3)|0;g=6160+((c[m+116>>2]&255)<<3)|0;k=r^c[e>>2]^c[g>>2];r=d^c[e+4>>2]^c[g+4>>2];g=m+120|0;e=Ua(c[g>>2]|0,c[g+4>>2]|0,24)|0;g=8208+((e&255)<<3)|0;e=k^c[g>>2];k=r^c[g+4>>2];g=m;r=Ua(c[g>>2]|0,c[g+4>>2]|0,16)|0;g=10256+((r&255)<<3)|0;r=e^c[g>>2];e=k^c[g+4>>2];g=m+8|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,8)|0;g=12304+((k&255)<<3)|0;k=14352+((c[m+48>>2]&255)<<3)|0;d=e^c[g+4>>2]^c[k+4>>2];e=n+88|0;c[e>>2]=r^c[g>>2]^c[k>>2];c[e+4>>2]=d;d=m+96|0;e=Ua(c[d>>2]|0,c[d+4>>2]|0,56)|0;d=16+(e<<3)|0;e=c[d>>2]|0;k=c[d+4>>2]|0;d=m+104|0;g=Ua(c[d>>2]|0,c[d+4>>2]|0,48)|0;d=2064+((g&255)<<3)|0;g=e^c[d>>2];e=k^c[d+4>>2];d=m+112|0;k=Ua(c[d>>2]|0,c[d+4>>2]|0,40)|0;d=4112+((k&255)<<3)|0;k=6160+((c[m+124>>2]&255)<<3)|0;r=g^c[d>>2]^c[k>>2];g=e^c[d+4>>2]^c[k+4>>2];k=m;d=Ua(c[k>>2]|0,c[k+4>>2]|0,24)|0;k=8208+((d&255)<<3)|0;d=r^c[k>>2];r=g^c[k+4>>2];k=m+8|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,16)|0;k=10256+((g&255)<<3)|0;g=d^c[k>>2];d=r^c[k+4>>2];k=m+16|0;r=Ua(c[k>>2]|0,c[k+4>>2]|0,8)|0;k=12304+((r&255)<<3)|0;r=14352+((c[m+56>>2]&255)<<3)|0;e=d^c[k+4>>2]^c[r+4>>2];d=n+96|0;c[d>>2]=g^c[k>>2]^c[r>>2];c[d+4>>2]=e;e=m+104|0;d=Ua(c[e>>2]|0,c[e+4>>2]|0,56)|0;e=16+(d<<3)|0;d=c[e>>2]|0;r=c[e+4>>2]|0;e=m+112|0;k=Ua(c[e>>2]|0,c[e+4>>2]|0,48)|0;e=2064+((k&255)<<3)|0;k=d^c[e>>2];d=r^c[e+4>>2];e=m+120|0;r=Ua(c[e>>2]|0,c[e+4>>2]|0,40)|0;e=4112+((r&255)<<3)|0;r=6160+((c[m+4>>2]&255)<<3)|0;g=k^c[e>>2]^c[r>>2];k=d^c[e+4>>2]^c[r+4>>2];r=m+8|0;e=Ua(c[r>>2]|0,c[r+4>>2]|0,24)|0;r=8208+((e&255)<<3)|0;e=g^c[r>>2];g=k^c[r+4>>2];r=m+16|0;k=Ua(c[r>>2]|0,c[r+4>>2]|0,16)|0;r=10256+((k&255)<<3)|0;k=e^c[r>>2];e=g^c[r+4>>2];r=m+24|0;g=Ua(c[r>>2]|0,c[r+4>>2]|0,8)|0;r=12304+((g&255)<<3)|0;g=14352+((c[m+64>>2]&255)<<3)|0;d=e^c[r+4>>2]^c[g+4>>2];e=n+104|0;c[e>>2]=k^c[r>>2]^c[g>>2];c[e+4>>2]=d;d=m+112|0;e=Ua(c[d>>2]|0,c[d+4>>2]|0,56)|0;d=16+(e<<3)|0;e=c[d>>2]|0;g=c[d+4>>2]|0;d=m+120|0;r=Ua(c[d>>2]|0,c[d+4>>2]|0,48)|0;d=2064+((r&255)<<3)|0;r=e^c[d>>2];e=g^c[d+4>>2];d=m;g=Ua(c[d>>2]|0,c[d+4>>2]|0,40)|0;d=4112+((g&255)<<3)|0;g=6160+((c[m+12>>2]&255)<<3)|0;k=r^c[d>>2]^c[g>>2];r=e^c[d+4>>2]^c[g+4>>2];g=m+16|0;d=Ua(c[g>>2]|0,c[g+4>>2]|0,24)|0;g=8208+((d&255)<<3)|0;d=k^c[g>>2];k=r^c[g+4>>2];g=m+24|0;r=Ua(c[g>>2]|0,c[g+4>>2]|0,16)|0;g=10256+((r&255)<<3)|0;r=d^c[g>>2];d=k^c[g+4>>2];g=m+32|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,8)|0;g=12304+((k&255)<<3)|0;k=14352+((c[m+72>>2]&255)<<3)|0;e=d^c[g+4>>2]^c[k+4>>2];d=n+112|0;c[d>>2]=r^c[g>>2]^c[k>>2];c[d+4>>2]=e;e=m+120|0;d=Ua(c[e>>2]|0,c[e+4>>2]|0,56)|0;e=16+(d<<3)|0;d=c[e>>2]|0;k=c[e+4>>2]|0;e=m;g=Ua(c[e>>2]|0,c[e+4>>2]|0,48)|0;e=2064+((g&255)<<3)|0;g=d^c[e>>2];d=k^c[e+4>>2];e=m+8|0;k=Ua(c[e>>2]|0,c[e+4>>2]|0,40)|0;e=4112+((k&255)<<3)|0;k=6160+((c[m+20>>2]&255)<<3)|0;r=g^c[e>>2]^c[k>>2];g=d^c[e+4>>2]^c[k+4>>2];k=m+24|0;e=Ua(c[k>>2]|0,c[k+4>>2]|0,24)|0;k=8208+((e&255)<<3)|0;e=r^c[k>>2];r=g^c[k+4>>2];k=m+32|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,16)|0;k=10256+((g&255)<<3)|0;g=e^c[k>>2];e=r^c[k+4>>2];k=m+40|0;r=Ua(c[k>>2]|0,c[k+4>>2]|0,8)|0;k=12304+((r&255)<<3)|0;r=14352+((c[m+80>>2]&255)<<3)|0;d=e^c[k+4>>2]^c[r+4>>2];e=n+120|0;c[e>>2]=g^c[k>>2]^c[r>>2];c[e+4>>2]=d;d=n;e=c[d+4>>2]|0;r=m;c[r>>2]=c[d>>2];c[r+4>>2]=e;e=n+8|0;r=c[e+4>>2]|0;d=m+8|0;c[d>>2]=c[e>>2];c[d+4>>2]=r;r=n+16|0;d=c[r+4>>2]|0;e=m+16|0;c[e>>2]=c[r>>2];c[e+4>>2]=d;d=n+24|0;e=c[d+4>>2]|0;r=m+24|0;c[r>>2]=c[d>>2];c[r+4>>2]=e;e=n+32|0;r=c[e+4>>2]|0;d=m+32|0;c[d>>2]=c[e>>2];c[d+4>>2]=r;r=n+40|0;d=c[r+4>>2]|0;e=m+40|0;c[e>>2]=c[r>>2];c[e+4>>2]=d;d=n+48|0;e=c[d+4>>2]|0;r=m+48|0;c[r>>2]=c[d>>2];c[r+4>>2]=e;e=n+56|0;r=c[e+4>>2]|0;d=m+56|0;c[d>>2]=c[e>>2];c[d+4>>2]=r;r=n+64|0;d=c[r+4>>2]|0;e=m+64|0;c[e>>2]=c[r>>2];c[e+4>>2]=d;d=n+72|0;e=c[d+4>>2]|0;r=m+72|0;c[r>>2]=c[d>>2];c[r+4>>2]=e;e=n+80|0;r=c[e+4>>2]|0;d=m+80|0;c[d>>2]=c[e>>2];c[d+4>>2]=r;r=n+88|0;d=c[r+4>>2]|0;e=m+88|0;c[e>>2]=c[r>>2];c[e+4>>2]=d;d=n+96|0;e=c[d+4>>2]|0;r=m+96|0;c[r>>2]=c[d>>2];c[r+4>>2]=e;e=n+104|0;r=c[e+4>>2]|0;d=m+104|0;c[d>>2]=c[e>>2];c[d+4>>2]=r;r=n+112|0;d=c[r+4>>2]|0;e=m+112|0;c[e>>2]=c[r>>2];c[e+4>>2]=d;d=n+120|0;e=c[d+4>>2]|0;r=m+120|0;c[r>>2]=c[d>>2];c[r+4>>2]=e;e=q+1|0;r=Va(e|0,((e|0)<0)<<31>>31|0,56)|0;e=m;d=e;k=c[d+4>>2]^D;g=e;c[g>>2]=c[d>>2]^r;c[g+4>>2]=k;k=q+17|0;g=Va(k|0,((k|0)<0)<<31>>31|0,56)|0;k=m+8|0;r=k;d=c[r+4>>2]^D;e=k;c[e>>2]=c[r>>2]^g;c[e+4>>2]=d;d=q+33|0;e=Va(d|0,((d|0)<0)<<31>>31|0,56)|0;d=m+16|0;g=d;r=c[g+4>>2]^D;k=d;c[k>>2]=c[g>>2]^e;c[k+4>>2]=r;r=q+49|0;k=Va(r|0,((r|0)<0)<<31>>31|0,56)|0;r=m+24|0;e=r;g=c[e+4>>2]^D;d=r;c[d>>2]=c[e>>2]^k;c[d+4>>2]=g;g=q+65|0;d=Va(g|0,((g|0)<0)<<31>>31|0,56)|0;g=m+32|0;k=g;e=c[k+4>>2]^D;r=g;c[r>>2]=c[k>>2]^d;c[r+4>>2]=e;e=q+81|0;r=Va(e|0,((e|0)<0)<<31>>31|0,56)|0;e=m+40|0;d=e;k=c[d+4>>2]^D;g=e;c[g>>2]=c[d>>2]^r;c[g+4>>2]=k;k=q+97|0;g=Va(k|0,((k|0)<0)<<31>>31|0,56)|0;k=m+48|0;r=k;d=c[r+4>>2]^D;e=k;c[e>>2]=c[r>>2]^g;c[e+4>>2]=d;d=q+113|0;e=Va(d|0,((d|0)<0)<<31>>31|0,56)|0;d=m+56|0;g=d;r=c[g+4>>2]^D;k=d;c[k>>2]=c[g>>2]^e;c[k+4>>2]=r;r=q+129|0;k=Va(r|0,((r|0)<0)<<31>>31|0,56)|0;r=m+64|0;e=r;g=c[e+4>>2]^D;d=r;c[d>>2]=c[e>>2]^k;c[d+4>>2]=g;g=q+145|0;d=Va(g|0,((g|0)<0)<<31>>31|0,56)|0;g=m+72|0;k=g;e=c[k+4>>2]^D;r=g;c[r>>2]=c[k>>2]^d;c[r+4>>2]=e;e=q+161|0;r=Va(e|0,((e|0)<0)<<31>>31|0,56)|0;e=m+80|0;d=e;k=c[d+4>>2]^D;g=e;c[g>>2]=c[d>>2]^r;c[g+4>>2]=k;k=q+177|0;g=Va(k|0,((k|0)<0)<<31>>31|0,56)|0;k=m+88|0;r=k;d=c[r+4>>2]^D;e=k;c[e>>2]=c[r>>2]^g;c[e+4>>2]=d;d=q+193|0;e=Va(d|0,((d|0)<0)<<31>>31|0,56)|0;d=m+96|0;g=d;r=c[g+4>>2]^D;k=d;c[k>>2]=c[g>>2]^e;c[k+4>>2]=r;r=q+209|0;k=Va(r|0,((r|0)<0)<<31>>31|0,56)|0;r=m+104|0;e=r;g=c[e+4>>2]^D;d=r;c[d>>2]=c[e>>2]^k;c[d+4>>2]=g;g=q+225|0;d=Va(g|0,((g|0)<0)<<31>>31|0,56)|0;g=m+112|0;k=g;e=c[k+4>>2]^D;r=g;c[r>>2]=c[k>>2]^d;c[r+4>>2]=e;e=q+241|0;r=Va(e|0,((e|0)<0)<<31>>31|0,56)|0;e=m+120|0;d=e;k=c[d+4>>2]^D;g=e;c[g>>2]=c[d>>2]^r;c[g+4>>2]=k;k=m;g=Ua(c[k>>2]|0,c[k+4>>2]|0,56)|0;k=16+(g<<3)|0;g=c[k>>2]|0;r=c[k+4>>2]|0;k=m+8|0;d=Ua(c[k>>2]|0,c[k+4>>2]|0,48)|0;k=2064+((d&255)<<3)|0;d=g^c[k>>2];g=r^c[k+4>>2];k=m+16|0;r=Ua(c[k>>2]|0,c[k+4>>2]|0,40)|0;k=4112+((r&255)<<3)|0;r=6160+((c[m+28>>2]&255)<<3)|0;e=d^c[k>>2]^c[r>>2];d=g^c[k+4>>2]^c[r+4>>2];r=m+32|0;k=Ua(c[r>>2]|0,c[r+4>>2]|0,24)|0;r=8208+((k&255)<<3)|0;k=e^c[r>>2];e=d^c[r+4>>2];r=m+40|0;d=Ua(c[r>>2]|0,c[r+4>>2]|0,16)|0;r=10256+((d&255)<<3)|0;d=k^c[r>>2];k=e^c[r+4>>2];r=m+48|0;e=Ua(c[r>>2]|0,c[r+4>>2]|0,8)|0;r=12304+((e&255)<<3)|0;e=14352+((c[m+88>>2]&255)<<3)|0;g=k^c[r+4>>2]^c[e+4>>2];k=o;c[k>>2]=d^c[r>>2]^c[e>>2];c[k+4>>2]=g;g=m+8|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,56)|0;g=16+(k<<3)|0;k=c[g>>2]|0;e=c[g+4>>2]|0;g=m+16|0;r=Ua(c[g>>2]|0,c[g+4>>2]|0,48)|0;g=2064+((r&255)<<3)|0;r=k^c[g>>2];k=e^c[g+4>>2];g=m+24|0;e=Ua(c[g>>2]|0,c[g+4>>2]|0,40)|0;g=4112+((e&255)<<3)|0;e=6160+((c[m+36>>2]&255)<<3)|0;d=r^c[g>>2]^c[e>>2];r=k^c[g+4>>2]^c[e+4>>2];e=m+40|0;g=Ua(c[e>>2]|0,c[e+4>>2]|0,24)|0;e=8208+((g&255)<<3)|0;g=d^c[e>>2];d=r^c[e+4>>2];e=m+48|0;r=Ua(c[e>>2]|0,c[e+4>>2]|0,16)|0;e=10256+((r&255)<<3)|0;r=g^c[e>>2];g=d^c[e+4>>2];e=m+56|0;d=Ua(c[e>>2]|0,c[e+4>>2]|0,8)|0;e=12304+((d&255)<<3)|0;d=14352+((c[m+96>>2]&255)<<3)|0;k=g^c[e+4>>2]^c[d+4>>2];g=o+8|0;c[g>>2]=r^c[e>>2]^c[d>>2];c[g+4>>2]=k;k=m+16|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,56)|0;k=16+(g<<3)|0;g=c[k>>2]|0;d=c[k+4>>2]|0;k=m+24|0;e=Ua(c[k>>2]|0,c[k+4>>2]|0,48)|0;k=2064+((e&255)<<3)|0;e=g^c[k>>2];g=d^c[k+4>>2];k=m+32|0;d=Ua(c[k>>2]|0,c[k+4>>2]|0,40)|0;k=4112+((d&255)<<3)|0;d=6160+((c[m+44>>2]&255)<<3)|0;r=e^c[k>>2]^c[d>>2];e=g^c[k+4>>2]^c[d+4>>2];d=m+48|0;k=Ua(c[d>>2]|0,c[d+4>>2]|0,24)|0;d=8208+((k&255)<<3)|0;k=r^c[d>>2];r=e^c[d+4>>2];d=m+56|0;e=Ua(c[d>>2]|0,c[d+4>>2]|0,16)|0;d=10256+((e&255)<<3)|0;e=k^c[d>>2];k=r^c[d+4>>2];d=m+64|0;r=Ua(c[d>>2]|0,c[d+4>>2]|0,8)|0;d=12304+((r&255)<<3)|0;r=14352+((c[m+104>>2]&255)<<3)|0;g=k^c[d+4>>2]^c[r+4>>2];k=o+16|0;c[k>>2]=e^c[d>>2]^c[r>>2];c[k+4>>2]=g;g=m+24|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,56)|0;g=16+(k<<3)|0;k=c[g>>2]|0;r=c[g+4>>2]|0;g=m+32|0;d=Ua(c[g>>2]|0,c[g+4>>2]|0,48)|0;g=2064+((d&255)<<3)|0;d=k^c[g>>2];k=r^c[g+4>>2];g=m+40|0;r=Ua(c[g>>2]|0,c[g+4>>2]|0,40)|0;g=4112+((r&255)<<3)|0;r=6160+((c[m+52>>2]&255)<<3)|0;e=d^c[g>>2]^c[r>>2];d=k^c[g+4>>2]^c[r+4>>2];r=m+56|0;g=Ua(c[r>>2]|0,c[r+4>>2]|0,24)|0;r=8208+((g&255)<<3)|0;g=e^c[r>>2];e=d^c[r+4>>2];r=m+64|0;d=Ua(c[r>>2]|0,c[r+4>>2]|0,16)|0;r=10256+((d&255)<<3)|0;d=g^c[r>>2];g=e^c[r+4>>2];r=m+72|0;e=Ua(c[r>>2]|0,c[r+4>>2]|0,8)|0;r=12304+((e&255)<<3)|0;e=14352+((c[m+112>>2]&255)<<3)|0;k=g^c[r+4>>2]^c[e+4>>2];g=o+24|0;c[g>>2]=d^c[r>>2]^c[e>>2];c[g+4>>2]=k;k=m+32|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,56)|0;k=16+(g<<3)|0;g=c[k>>2]|0;e=c[k+4>>2]|0;k=m+40|0;r=Ua(c[k>>2]|0,c[k+4>>2]|0,48)|0;k=2064+((r&255)<<3)|0;r=g^c[k>>2];g=e^c[k+4>>2];k=m+48|0;e=Ua(c[k>>2]|0,c[k+4>>2]|0,40)|0;k=4112+((e&255)<<3)|0;e=6160+((c[m+60>>2]&255)<<3)|0;d=r^c[k>>2]^c[e>>2];r=g^c[k+4>>2]^c[e+4>>2];e=m+64|0;k=Ua(c[e>>2]|0,c[e+4>>2]|0,24)|0;e=8208+((k&255)<<3)|0;k=d^c[e>>2];d=r^c[e+4>>2];e=m+72|0;r=Ua(c[e>>2]|0,c[e+4>>2]|0,16)|0;e=10256+((r&255)<<3)|0;r=k^c[e>>2];k=d^c[e+4>>2];e=m+80|0;d=Ua(c[e>>2]|0,c[e+4>>2]|0,8)|0;e=12304+((d&255)<<3)|0;d=14352+((c[m+120>>2]&255)<<3)|0;g=k^c[e+4>>2]^c[d+4>>2];k=o+32|0;c[k>>2]=r^c[e>>2]^c[d>>2];c[k+4>>2]=g;g=m+40|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,56)|0;g=16+(k<<3)|0;k=c[g>>2]|0;d=c[g+4>>2]|0;g=m+48|0;e=Ua(c[g>>2]|0,c[g+4>>2]|0,48)|0;g=2064+((e&255)<<3)|0;e=k^c[g>>2];k=d^c[g+4>>2];g=m+56|0;d=Ua(c[g>>2]|0,c[g+4>>2]|0,40)|0;g=4112+((d&255)<<3)|0;d=6160+((c[m+68>>2]&255)<<3)|0;r=e^c[g>>2]^c[d>>2];e=k^c[g+4>>2]^c[d+4>>2];d=m+72|0;g=Ua(c[d>>2]|0,c[d+4>>2]|0,24)|0;d=8208+((g&255)<<3)|0;g=r^c[d>>2];r=e^c[d+4>>2];d=m+80|0;e=Ua(c[d>>2]|0,c[d+4>>2]|0,16)|0;d=10256+((e&255)<<3)|0;e=g^c[d>>2];g=r^c[d+4>>2];d=m+88|0;r=Ua(c[d>>2]|0,c[d+4>>2]|0,8)|0;d=12304+((r&255)<<3)|0;r=14352+((c[m>>2]&255)<<3)|0;k=g^c[d+4>>2]^c[r+4>>2];g=o+40|0;c[g>>2]=e^c[d>>2]^c[r>>2];c[g+4>>2]=k;k=m+48|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,56)|0;k=16+(g<<3)|0;g=c[k>>2]|0;r=c[k+4>>2]|0;k=m+56|0;d=Ua(c[k>>2]|0,c[k+4>>2]|0,48)|0;k=2064+((d&255)<<3)|0;d=g^c[k>>2];g=r^c[k+4>>2];k=m+64|0;r=Ua(c[k>>2]|0,c[k+4>>2]|0,40)|0;k=4112+((r&255)<<3)|0;r=6160+((c[m+76>>2]&255)<<3)|0;e=d^c[k>>2]^c[r>>2];d=g^c[k+4>>2]^c[r+4>>2];r=m+80|0;k=Ua(c[r>>2]|0,c[r+4>>2]|0,24)|0;r=8208+((k&255)<<3)|0;k=e^c[r>>2];e=d^c[r+4>>2];r=m+88|0;d=Ua(c[r>>2]|0,c[r+4>>2]|0,16)|0;r=10256+((d&255)<<3)|0;d=k^c[r>>2];k=e^c[r+4>>2];r=m+96|0;e=Ua(c[r>>2]|0,c[r+4>>2]|0,8)|0;r=12304+((e&255)<<3)|0;e=14352+((c[m+8>>2]&255)<<3)|0;g=k^c[r+4>>2]^c[e+4>>2];k=o+48|0;c[k>>2]=d^c[r>>2]^c[e>>2];c[k+4>>2]=g;g=m+56|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,56)|0;g=16+(k<<3)|0;k=c[g>>2]|0;e=c[g+4>>2]|0;g=m+64|0;r=Ua(c[g>>2]|0,c[g+4>>2]|0,48)|0;g=2064+((r&255)<<3)|0;r=k^c[g>>2];k=e^c[g+4>>2];g=m+72|0;e=Ua(c[g>>2]|0,c[g+4>>2]|0,40)|0;g=4112+((e&255)<<3)|0;e=6160+((c[m+84>>2]&255)<<3)|0;d=r^c[g>>2]^c[e>>2];r=k^c[g+4>>2]^c[e+4>>2];e=m+88|0;g=Ua(c[e>>2]|0,c[e+4>>2]|0,24)|0;e=8208+((g&255)<<3)|0;g=d^c[e>>2];d=r^c[e+4>>2];e=m+96|0;r=Ua(c[e>>2]|0,c[e+4>>2]|0,16)|0;e=10256+((r&255)<<3)|0;r=g^c[e>>2];g=d^c[e+4>>2];e=m+104|0;d=Ua(c[e>>2]|0,c[e+4>>2]|0,8)|0;e=12304+((d&255)<<3)|0;d=14352+((c[m+16>>2]&255)<<3)|0;k=g^c[e+4>>2]^c[d+4>>2];g=o+56|0;c[g>>2]=r^c[e>>2]^c[d>>2];c[g+4>>2]=k;k=m+64|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,56)|0;k=16+(g<<3)|0;g=c[k>>2]|0;d=c[k+4>>2]|0;k=m+72|0;e=Ua(c[k>>2]|0,c[k+4>>2]|0,48)|0;k=2064+((e&255)<<3)|0;e=g^c[k>>2];g=d^c[k+4>>2];k=m+80|0;d=Ua(c[k>>2]|0,c[k+4>>2]|0,40)|0;k=4112+((d&255)<<3)|0;d=6160+((c[m+92>>2]&255)<<3)|0;r=e^c[k>>2]^c[d>>2];e=g^c[k+4>>2]^c[d+4>>2];d=m+96|0;k=Ua(c[d>>2]|0,c[d+4>>2]|0,24)|0;d=8208+((k&255)<<3)|0;k=r^c[d>>2];r=e^c[d+4>>2];d=m+104|0;e=Ua(c[d>>2]|0,c[d+4>>2]|0,16)|0;d=10256+((e&255)<<3)|0;e=k^c[d>>2];k=r^c[d+4>>2];d=m+112|0;r=Ua(c[d>>2]|0,c[d+4>>2]|0,8)|0;d=12304+((r&255)<<3)|0;r=14352+((c[m+24>>2]&255)<<3)|0;g=k^c[d+4>>2]^c[r+4>>2];k=o+64|0;c[k>>2]=e^c[d>>2]^c[r>>2];c[k+4>>2]=g;g=m+72|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,56)|0;g=16+(k<<3)|0;k=c[g>>2]|0;r=c[g+4>>2]|0;g=m+80|0;d=Ua(c[g>>2]|0,c[g+4>>2]|0,48)|0;g=2064+((d&255)<<3)|0;d=k^c[g>>2];k=r^c[g+4>>2];g=m+88|0;r=Ua(c[g>>2]|0,c[g+4>>2]|0,40)|0;g=4112+((r&255)<<3)|0;r=6160+((c[m+100>>2]&255)<<3)|0;e=d^c[g>>2]^c[r>>2];d=k^c[g+4>>2]^c[r+4>>2];r=m+104|0;g=Ua(c[r>>2]|0,c[r+4>>2]|0,24)|0;r=8208+((g&255)<<3)|0;g=e^c[r>>2];e=d^c[r+4>>2];r=m+112|0;d=Ua(c[r>>2]|0,c[r+4>>2]|0,16)|0;r=10256+((d&255)<<3)|0;d=g^c[r>>2];g=e^c[r+4>>2];r=m+120|0;e=Ua(c[r>>2]|0,c[r+4>>2]|0,8)|0;r=12304+((e&255)<<3)|0;e=14352+((c[m+32>>2]&255)<<3)|0;k=g^c[r+4>>2]^c[e+4>>2];g=o+72|0;c[g>>2]=d^c[r>>2]^c[e>>2];c[g+4>>2]=k;k=m+80|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,56)|0;k=16+(g<<3)|0;g=c[k>>2]|0;e=c[k+4>>2]|0;k=m+88|0;r=Ua(c[k>>2]|0,c[k+4>>2]|0,48)|0;k=2064+((r&255)<<3)|0;r=g^c[k>>2];g=e^c[k+4>>2];k=m+96|0;e=Ua(c[k>>2]|0,c[k+4>>2]|0,40)|0;k=4112+((e&255)<<3)|0;e=6160+((c[m+108>>2]&255)<<3)|0;d=r^c[k>>2]^c[e>>2];r=g^c[k+4>>2]^c[e+4>>2];e=m+112|0;k=Ua(c[e>>2]|0,c[e+4>>2]|0,24)|0;e=8208+((k&255)<<3)|0;k=d^c[e>>2];d=r^c[e+4>>2];e=m+120|0;r=Ua(c[e>>2]|0,c[e+4>>2]|0,16)|0;e=10256+((r&255)<<3)|0;r=k^c[e>>2];k=d^c[e+4>>2];e=m;d=Ua(c[e>>2]|0,c[e+4>>2]|0,8)|0;e=12304+((d&255)<<3)|0;d=14352+((c[m+40>>2]&255)<<3)|0;g=k^c[e+4>>2]^c[d+4>>2];k=o+80|0;c[k>>2]=r^c[e>>2]^c[d>>2];c[k+4>>2]=g;g=m+88|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,56)|0;g=16+(k<<3)|0;k=c[g>>2]|0;d=c[g+4>>2]|0;g=m+96|0;e=Ua(c[g>>2]|0,c[g+4>>2]|0,48)|0;g=2064+((e&255)<<3)|0;e=k^c[g>>2];k=d^c[g+4>>2];g=m+104|0;d=Ua(c[g>>2]|0,c[g+4>>2]|0,40)|0;g=4112+((d&255)<<3)|0;d=6160+((c[m+116>>2]&255)<<3)|0;r=e^c[g>>2]^c[d>>2];e=k^c[g+4>>2]^c[d+4>>2];d=m+120|0;g=Ua(c[d>>2]|0,c[d+4>>2]|0,24)|0;d=8208+((g&255)<<3)|0;g=r^c[d>>2];r=e^c[d+4>>2];d=m;e=Ua(c[d>>2]|0,c[d+4>>2]|0,16)|0;d=10256+((e&255)<<3)|0;e=g^c[d>>2];g=r^c[d+4>>2];d=m+8|0;r=Ua(c[d>>2]|0,c[d+4>>2]|0,8)|0;d=12304+((r&255)<<3)|0;r=14352+((c[m+48>>2]&255)<<3)|0;k=g^c[d+4>>2]^c[r+4>>2];g=o+88|0;c[g>>2]=e^c[d>>2]^c[r>>2];c[g+4>>2]=k;k=m+96|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,56)|0;k=16+(g<<3)|0;g=c[k>>2]|0;r=c[k+4>>2]|0;k=m+104|0;d=Ua(c[k>>2]|0,c[k+4>>2]|0,48)|0;k=2064+((d&255)<<3)|0;d=g^c[k>>2];g=r^c[k+4>>2];k=m+112|0;r=Ua(c[k>>2]|0,c[k+4>>2]|0,40)|0;k=4112+((r&255)<<3)|0;r=6160+((c[m+124>>2]&255)<<3)|0;e=d^c[k>>2]^c[r>>2];d=g^c[k+4>>2]^c[r+4>>2];r=m;k=Ua(c[r>>2]|0,c[r+4>>2]|0,24)|0;r=8208+((k&255)<<3)|0;k=e^c[r>>2];e=d^c[r+4>>2];r=m+8|0;d=Ua(c[r>>2]|0,c[r+4>>2]|0,16)|0;r=10256+((d&255)<<3)|0;d=k^c[r>>2];k=e^c[r+4>>2];r=m+16|0;e=Ua(c[r>>2]|0,c[r+4>>2]|0,8)|0;r=12304+((e&255)<<3)|0;e=14352+((c[m+56>>2]&255)<<3)|0;g=k^c[r+4>>2]^c[e+4>>2];k=o+96|0;c[k>>2]=d^c[r>>2]^c[e>>2];c[k+4>>2]=g;g=m+104|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,56)|0;g=16+(k<<3)|0;k=c[g>>2]|0;e=c[g+4>>2]|0;g=m+112|0;r=Ua(c[g>>2]|0,c[g+4>>2]|0,48)|0;g=2064+((r&255)<<3)|0;r=k^c[g>>2];k=e^c[g+4>>2];g=m+120|0;e=Ua(c[g>>2]|0,c[g+4>>2]|0,40)|0;g=4112+((e&255)<<3)|0;e=6160+((c[m+4>>2]&255)<<3)|0;d=r^c[g>>2]^c[e>>2];r=k^c[g+4>>2]^c[e+4>>2];e=m+8|0;g=Ua(c[e>>2]|0,c[e+4>>2]|0,24)|0;e=8208+((g&255)<<3)|0;g=d^c[e>>2];d=r^c[e+4>>2];e=m+16|0;r=Ua(c[e>>2]|0,c[e+4>>2]|0,16)|0;e=10256+((r&255)<<3)|0;r=g^c[e>>2];g=d^c[e+4>>2];e=m+24|0;d=Ua(c[e>>2]|0,c[e+4>>2]|0,8)|0;e=12304+((d&255)<<3)|0;d=14352+((c[m+64>>2]&255)<<3)|0;k=g^c[e+4>>2]^c[d+4>>2];g=o+104|0;c[g>>2]=r^c[e>>2]^c[d>>2];c[g+4>>2]=k;k=m+112|0;g=Ua(c[k>>2]|0,c[k+4>>2]|0,56)|0;k=16+(g<<3)|0;g=c[k>>2]|0;d=c[k+4>>2]|0;k=m+120|0;e=Ua(c[k>>2]|0,c[k+4>>2]|0,48)|0;k=2064+((e&255)<<3)|0;e=g^c[k>>2];g=d^c[k+4>>2];k=m;d=Ua(c[k>>2]|0,c[k+4>>2]|0,40)|0;k=4112+((d&255)<<3)|0;d=6160+((c[m+12>>2]&255)<<3)|0;r=e^c[k>>2]^c[d>>2];e=g^c[k+4>>2]^c[d+4>>2];d=m+16|0;k=Ua(c[d>>2]|0,c[d+4>>2]|0,24)|0;d=8208+((k&255)<<3)|0;k=r^c[d>>2];r=e^c[d+4>>2];d=m+24|0;e=Ua(c[d>>2]|0,c[d+4>>2]|0,16)|0;d=10256+((e&255)<<3)|0;e=k^c[d>>2];k=r^c[d+4>>2];d=m+32|0;r=Ua(c[d>>2]|0,c[d+4>>2]|0,8)|0;d=12304+((r&255)<<3)|0;r=14352+((c[m+72>>2]&255)<<3)|0;g=k^c[d+4>>2]^c[r+4>>2];k=o+112|0;c[k>>2]=e^c[d>>2]^c[r>>2];c[k+4>>2]=g;g=m+120|0;k=Ua(c[g>>2]|0,c[g+4>>2]|0,56)|0;g=16+(k<<3)|0;k=c[g>>2]|0;r=c[g+4>>2]|0;g=m;d=Ua(c[g>>2]|0,c[g+4>>2]|0,48)|0;g=2064+((d&255)<<3)|0;d=k^c[g>>2];k=r^c[g+4>>2];g=m+8|0;r=Ua(c[g>>2]|0,c[g+4>>2]|0,40)|0;g=4112+((r&255)<<3)|0;r=6160+((c[m+20>>2]&255)<<3)|0;e=d^c[g>>2]^c[r>>2];d=k^c[g+4>>2]^c[r+4>>2];r=m+24|0;g=Ua(c[r>>2]|0,c[r+4>>2]|0,24)|0;r=8208+((g&255)<<3)|0;g=e^c[r>>2];e=d^c[r+4>>2];r=m+32|0;d=Ua(c[r>>2]|0,c[r+4>>2]|0,16)|0;r=10256+((d&255)<<3)|0;d=g^c[r>>2];g=e^c[r+4>>2];r=m+40|0;e=Ua(c[r>>2]|0,c[r+4>>2]|0,8)|0;r=12304+((e&255)<<3)|0;e=14352+((c[m+80>>2]&255)<<3)|0;k=g^c[r+4>>2]^c[e+4>>2];g=o+120|0;c[g>>2]=d^c[r>>2]^c[e>>2];c[g+4>>2]=k;k=o;g=c[k+4>>2]|0;e=m;c[e>>2]=c[k>>2];c[e+4>>2]=g;g=o+8|0;e=c[g+4>>2]|0;k=m+8|0;c[k>>2]=c[g>>2];c[k+4>>2]=e;e=o+16|0;k=c[e+4>>2]|0;g=m+16|0;c[g>>2]=c[e>>2];c[g+4>>2]=k;k=o+24|0;g=c[k+4>>2]|0;e=m+24|0;c[e>>2]=c[k>>2];c[e+4>>2]=g;g=o+32|0;e=c[g+4>>2]|0;k=m+32|0;c[k>>2]=c[g>>2];c[k+4>>2]=e;e=o+40|0;k=c[e+4>>2]|0;g=m+40|0;c[g>>2]=c[e>>2];c[g+4>>2]=k;k=o+48|0;g=c[k+4>>2]|0;e=m+48|0;c[e>>2]=c[k>>2];c[e+4>>2]=g;g=o+56|0;e=c[g+4>>2]|0;k=m+56|0;c[k>>2]=c[g>>2];c[k+4>>2]=e;e=o+64|0;k=c[e+4>>2]|0;g=m+64|0;c[g>>2]=c[e>>2];c[g+4>>2]=k;k=o+72|0;g=c[k+4>>2]|0;e=m+72|0;c[e>>2]=c[k>>2];c[e+4>>2]=g;g=o+80|0;e=c[g+4>>2]|0;k=m+80|0;c[k>>2]=c[g>>2];c[k+4>>2]=e;e=o+88|0;k=c[e+4>>2]|0;g=m+88|0;c[g>>2]=c[e>>2];c[g+4>>2]=k;k=o+96|0;g=c[k+4>>2]|0;e=m+96|0;c[e>>2]=c[k>>2];c[e+4>>2]=g;g=o+104|0;e=c[g+4>>2]|0;k=m+104|0;c[k>>2]=c[g>>2];c[k+4>>2]=e;e=o+112|0;k=c[e+4>>2]|0;g=m+112|0;c[g>>2]=c[e>>2];c[g+4>>2]=k;k=o+120|0;g=c[k+4>>2]|0;e=m+120|0;c[e>>2]=c[k>>2];c[e+4>>2]=g;q=q+2|0}q=0;while(1){if(!(q>>>0<16)){break}o=m+(q<<3)|0;n=l+(q<<3)|0;g=n;e=c[g+4>>2]^c[o+4>>2];k=n;c[k>>2]=c[g>>2]^c[o>>2];c[k+4>>2]=e;q=q+1|0}q=0;while(1){if(!(q>>>0<8)){break}m=l+(q+8<<3)|0;Na(j+(q<<3)|0,c[m>>2]|0,c[m+4>>2]|0);q=q+1|0}Xa(b|0,j+64+(0-f)|0,f|0)|0;Ha(p,f<<3);i=h;return}function Ka(a){a=a|0;var b=0;b=i;i=i+8|0;Ha(a,512);i=b;return}function La(a,b,c){a=a|0;b=b|0;c=c|0;var d=0;d=i;i=i+24|0;Ia(a,b,c);i=d;return}function Ma(a,b){a=a|0;b=b|0;var c=0;c=i;i=i+16|0;Ja(a,0,0,b,64);i=c;return}function Na(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=i;i=i+16|0;g=f+8|0;h=b;b=g;c[b>>2]=d;c[b+4>>2]=e;e=g;b=Ua(c[e>>2]|0,c[e+4>>2]|0,56)|0;a[h]=b;b=g;e=Ua(c[b>>2]|0,c[b+4>>2]|0,48)|0;a[h+1|0]=e;e=g;b=Ua(c[e>>2]|0,c[e+4>>2]|0,40)|0;a[h+2|0]=b;a[h+3|0]=c[g+4>>2];b=g;e=Ua(c[b>>2]|0,c[b+4>>2]|0,24)|0;a[h+4|0]=e;e=g;b=Ua(c[e>>2]|0,c[e+4>>2]|0,16)|0;a[h+5|0]=b;b=g;e=Ua(c[b>>2]|0,c[b+4>>2]|0,8)|0;a[h+6|0]=e;a[h+7|0]=c[g>>2];i=f;return}function Oa(a){a=a|0;var b=0,c=0,e=0,f=0,g=0,h=0,j=0,k=0;b=i;i=i+8|0;c=a;a=Va(d[c]|0|0,0,56)|0;e=D;f=Va(d[c+1|0]|0|0,0,48)|0;g=e|D;e=Va(d[c+2|0]|0|0,0,40)|0;h=g|D|(d[c+3|0]|0);g=Va(d[c+4|0]|0|0,0,24)|0;j=h|D;h=Va(d[c+5|0]|0|0,0,16)|0;k=j|D;j=Va(d[c+6|0]|0|0,0,8)|0;D=k|D;i=b;return a|f|e|g|h|j|(d[c+7|0]|0)|0}function Pa(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ha=0,ka=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0,Ma=0,Na=0,Oa=0,Pa=0,Qa=0,Ra=0,Sa=0;b=i;do{if(a>>>0<245){if(a>>>0<11){d=16}else{d=a+11&-8}e=d>>>3;f=c[4100]|0;g=f>>>e;if((g&3|0)!=0){h=(g&1^1)+e|0;j=h<<1;k=16440+(j<<2)|0;l=16440+(j+2<<2)|0;j=c[l>>2]|0;m=j+8|0;n=c[m>>2]|0;do{if((k|0)==(n|0)){c[4100]=f&~(1<<h)}else{if(n>>>0<(c[16416>>2]|0)>>>0){ga()}o=n+12|0;if((c[o>>2]|0)==(j|0)){c[o>>2]=k;c[l>>2]=n;break}else{ga()}}}while(0);n=h<<3;c[j+4>>2]=n|3;l=j+(n|4)|0;c[l>>2]=c[l>>2]|1;p=m;i=b;return p|0}if(!(d>>>0>(c[16408>>2]|0)>>>0)){q=d;break}if((g|0)!=0){l=2<<e;n=g<<e&(l|0-l);l=(n&0-n)+ -1|0;n=l>>>12&16;k=l>>>n;l=k>>>5&8;o=k>>>l;k=o>>>2&4;r=o>>>k;o=r>>>1&2;s=r>>>o;r=s>>>1&1;t=(l|n|k|o|r)+(s>>>r)|0;r=t<<1;s=16440+(r<<2)|0;o=16440+(r+2<<2)|0;r=c[o>>2]|0;k=r+8|0;n=c[k>>2]|0;do{if((s|0)==(n|0)){c[4100]=f&~(1<<t)}else{if(n>>>0<(c[16416>>2]|0)>>>0){ga()}l=n+12|0;if((c[l>>2]|0)==(r|0)){c[l>>2]=s;c[o>>2]=n;break}else{ga()}}}while(0);n=t<<3;o=n-d|0;c[r+4>>2]=d|3;s=r;f=s+d|0;c[s+(d|4)>>2]=o|1;c[s+n>>2]=o;n=c[16408>>2]|0;if((n|0)!=0){s=c[16420>>2]|0;e=n>>>3;n=e<<1;g=16440+(n<<2)|0;m=c[4100]|0;j=1<<e;do{if((m&j|0)==0){c[4100]=m|j;u=16440+(n+2<<2)|0;v=g}else{e=16440+(n+2<<2)|0;h=c[e>>2]|0;if(!(h>>>0<(c[16416>>2]|0)>>>0)){u=e;v=h;break}ga()}}while(0);c[u>>2]=s;c[v+12>>2]=s;c[s+8>>2]=v;c[s+12>>2]=g}c[16408>>2]=o;c[16420>>2]=f;p=k;i=b;return p|0}n=c[16404>>2]|0;if((n|0)==0){q=d;break}j=(n&0-n)+ -1|0;n=j>>>12&16;m=j>>>n;j=m>>>5&8;r=m>>>j;m=r>>>2&4;t=r>>>m;r=t>>>1&2;h=t>>>r;t=h>>>1&1;e=c[16704+((j|n|m|r|t)+(h>>>t)<<2)>>2]|0;t=(c[e+4>>2]&-8)-d|0;h=e;r=e;while(1){e=c[h+16>>2]|0;if((e|0)==0){m=c[h+20>>2]|0;if((m|0)==0){break}else{w=m}}else{w=e}e=(c[w+4>>2]&-8)-d|0;m=e>>>0<t>>>0;t=m?e:t;h=w;r=m?w:r}h=r;k=c[16416>>2]|0;if(h>>>0<k>>>0){ga()}f=h+d|0;o=f;if(!(h>>>0<f>>>0)){ga()}f=c[r+24>>2]|0;g=c[r+12>>2]|0;do{if((g|0)==(r|0)){s=r+20|0;m=c[s>>2]|0;if((m|0)==0){e=r+16|0;n=c[e>>2]|0;if((n|0)==0){x=0;break}else{y=n;z=e}}else{y=m;z=s}while(1){s=y+20|0;m=c[s>>2]|0;if((m|0)!=0){z=s;y=m;continue}m=y+16|0;s=c[m>>2]|0;if((s|0)==0){break}else{y=s;z=m}}if(z>>>0<k>>>0){ga()}else{c[z>>2]=0;x=y;break}}else{m=c[r+8>>2]|0;if(m>>>0<k>>>0){ga()}s=m+12|0;if((c[s>>2]|0)!=(r|0)){ga()}e=g+8|0;if((c[e>>2]|0)==(r|0)){c[s>>2]=g;c[e>>2]=m;x=g;break}else{ga()}}}while(0);a:do{if((f|0)!=0){g=c[r+28>>2]|0;k=16704+(g<<2)|0;do{if((r|0)==(c[k>>2]|0)){c[k>>2]=x;if((x|0)!=0){break}c[16404>>2]=c[16404>>2]&~(1<<g);break a}else{if(f>>>0<(c[16416>>2]|0)>>>0){ga()}m=f+16|0;if((c[m>>2]|0)==(r|0)){c[m>>2]=x}else{c[f+20>>2]=x}if((x|0)==0){break a}}}while(0);if(x>>>0<(c[16416>>2]|0)>>>0){ga()}c[x+24>>2]=f;g=c[r+16>>2]|0;do{if((g|0)!=0){if(g>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[x+16>>2]=g;c[g+24>>2]=x;break}}}while(0);g=c[r+20>>2]|0;if((g|0)==0){break}if(g>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[x+20>>2]=g;c[g+24>>2]=x;break}}}while(0);if(t>>>0<16){f=t+d|0;c[r+4>>2]=f|3;g=h+(f+4)|0;c[g>>2]=c[g>>2]|1}else{c[r+4>>2]=d|3;c[h+(d|4)>>2]=t|1;c[h+(t+d)>>2]=t;g=c[16408>>2]|0;if((g|0)!=0){f=c[16420>>2]|0;k=g>>>3;g=k<<1;m=16440+(g<<2)|0;e=c[4100]|0;s=1<<k;do{if((e&s|0)==0){c[4100]=e|s;A=16440+(g+2<<2)|0;B=m}else{k=16440+(g+2<<2)|0;n=c[k>>2]|0;if(!(n>>>0<(c[16416>>2]|0)>>>0)){A=k;B=n;break}ga()}}while(0);c[A>>2]=f;c[B+12>>2]=f;c[f+8>>2]=B;c[f+12>>2]=m}c[16408>>2]=t;c[16420>>2]=o}p=r+8|0;i=b;return p|0}else{if(a>>>0>4294967231){q=-1;break}g=a+11|0;s=g&-8;e=c[16404>>2]|0;if((e|0)==0){q=s;break}h=0-s|0;n=g>>>8;do{if((n|0)==0){C=0}else{if(s>>>0>16777215){C=31;break}g=(n+1048320|0)>>>16&8;k=n<<g;j=(k+520192|0)>>>16&4;l=k<<j;k=(l+245760|0)>>>16&2;D=14-(j|g|k)+(l<<k>>>15)|0;C=s>>>(D+7|0)&1|D<<1}}while(0);n=c[16704+(C<<2)>>2]|0;b:do{if((n|0)==0){E=h;F=0;G=0}else{if((C|0)==31){H=0}else{H=25-(C>>>1)|0}r=h;o=0;t=s<<H;m=n;f=0;while(1){D=c[m+4>>2]&-8;k=D-s|0;if(k>>>0<r>>>0){if((D|0)==(s|0)){E=k;F=m;G=m;break b}else{I=k;J=m}}else{I=r;J=f}k=c[m+20>>2]|0;D=c[m+(t>>>31<<2)+16>>2]|0;l=(k|0)==0|(k|0)==(D|0)?o:k;if((D|0)==0){E=I;F=l;G=J;break}else{r=I;o=l;t=t<<1;m=D;f=J}}}}while(0);if((F|0)==0&(G|0)==0){n=2<<C;h=e&(n|0-n);if((h|0)==0){q=s;break}n=(h&0-h)+ -1|0;h=n>>>12&16;f=n>>>h;n=f>>>5&8;m=f>>>n;f=m>>>2&4;t=m>>>f;m=t>>>1&2;o=t>>>m;t=o>>>1&1;K=c[16704+((n|h|f|m|t)+(o>>>t)<<2)>>2]|0}else{K=F}if((K|0)==0){L=E;M=G}else{t=E;o=K;m=G;while(1){f=(c[o+4>>2]&-8)-s|0;h=f>>>0<t>>>0;n=h?f:t;f=h?o:m;h=c[o+16>>2]|0;if((h|0)!=0){N=f;O=n;m=N;o=h;t=O;continue}h=c[o+20>>2]|0;if((h|0)==0){L=n;M=f;break}else{N=f;O=n;o=h;m=N;t=O}}}if((M|0)==0){q=s;break}if(!(L>>>0<((c[16408>>2]|0)-s|0)>>>0)){q=s;break}t=M;m=c[16416>>2]|0;if(t>>>0<m>>>0){ga()}o=t+s|0;e=o;if(!(t>>>0<o>>>0)){ga()}h=c[M+24>>2]|0;n=c[M+12>>2]|0;do{if((n|0)==(M|0)){f=M+20|0;r=c[f>>2]|0;if((r|0)==0){D=M+16|0;l=c[D>>2]|0;if((l|0)==0){P=0;break}else{Q=l;R=D}}else{Q=r;R=f}while(1){f=Q+20|0;r=c[f>>2]|0;if((r|0)!=0){R=f;Q=r;continue}r=Q+16|0;f=c[r>>2]|0;if((f|0)==0){break}else{Q=f;R=r}}if(R>>>0<m>>>0){ga()}else{c[R>>2]=0;P=Q;break}}else{r=c[M+8>>2]|0;if(r>>>0<m>>>0){ga()}f=r+12|0;if((c[f>>2]|0)!=(M|0)){ga()}D=n+8|0;if((c[D>>2]|0)==(M|0)){c[f>>2]=n;c[D>>2]=r;P=n;break}else{ga()}}}while(0);c:do{if((h|0)!=0){n=c[M+28>>2]|0;m=16704+(n<<2)|0;do{if((M|0)==(c[m>>2]|0)){c[m>>2]=P;if((P|0)!=0){break}c[16404>>2]=c[16404>>2]&~(1<<n);break c}else{if(h>>>0<(c[16416>>2]|0)>>>0){ga()}r=h+16|0;if((c[r>>2]|0)==(M|0)){c[r>>2]=P}else{c[h+20>>2]=P}if((P|0)==0){break c}}}while(0);if(P>>>0<(c[16416>>2]|0)>>>0){ga()}c[P+24>>2]=h;n=c[M+16>>2]|0;do{if((n|0)!=0){if(n>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[P+16>>2]=n;c[n+24>>2]=P;break}}}while(0);n=c[M+20>>2]|0;if((n|0)==0){break}if(n>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[P+20>>2]=n;c[n+24>>2]=P;break}}}while(0);d:do{if(L>>>0<16){h=L+s|0;c[M+4>>2]=h|3;n=t+(h+4)|0;c[n>>2]=c[n>>2]|1}else{c[M+4>>2]=s|3;c[t+(s|4)>>2]=L|1;c[t+(L+s)>>2]=L;n=L>>>3;if(L>>>0<256){h=n<<1;m=16440+(h<<2)|0;r=c[4100]|0;D=1<<n;do{if((r&D|0)==0){c[4100]=r|D;S=16440+(h+2<<2)|0;T=m}else{n=16440+(h+2<<2)|0;f=c[n>>2]|0;if(!(f>>>0<(c[16416>>2]|0)>>>0)){S=n;T=f;break}ga()}}while(0);c[S>>2]=e;c[T+12>>2]=e;c[t+(s+8)>>2]=T;c[t+(s+12)>>2]=m;break}h=o;D=L>>>8;do{if((D|0)==0){U=0}else{if(L>>>0>16777215){U=31;break}r=(D+1048320|0)>>>16&8;f=D<<r;n=(f+520192|0)>>>16&4;l=f<<n;f=(l+245760|0)>>>16&2;k=14-(n|r|f)+(l<<f>>>15)|0;U=L>>>(k+7|0)&1|k<<1}}while(0);D=16704+(U<<2)|0;c[t+(s+28)>>2]=U;c[t+(s+20)>>2]=0;c[t+(s+16)>>2]=0;m=c[16404>>2]|0;k=1<<U;if((m&k|0)==0){c[16404>>2]=m|k;c[D>>2]=h;c[t+(s+24)>>2]=D;c[t+(s+12)>>2]=h;c[t+(s+8)>>2]=h;break}k=c[D>>2]|0;if((U|0)==31){V=0}else{V=25-(U>>>1)|0}e:do{if((c[k+4>>2]&-8|0)==(L|0)){W=k}else{D=L<<V;m=k;while(1){X=m+(D>>>31<<2)+16|0;f=c[X>>2]|0;if((f|0)==0){break}if((c[f+4>>2]&-8|0)==(L|0)){W=f;break e}else{D=D<<1;m=f}}if(X>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[X>>2]=h;c[t+(s+24)>>2]=m;c[t+(s+12)>>2]=h;c[t+(s+8)>>2]=h;break d}}}while(0);k=W+8|0;D=c[k>>2]|0;f=c[16416>>2]|0;if(W>>>0<f>>>0){ga()}if(D>>>0<f>>>0){ga()}else{c[D+12>>2]=h;c[k>>2]=h;c[t+(s+8)>>2]=D;c[t+(s+12)>>2]=W;c[t+(s+24)>>2]=0;break}}}while(0);p=M+8|0;i=b;return p|0}}while(0);M=c[16408>>2]|0;if(!(q>>>0>M>>>0)){W=M-q|0;X=c[16420>>2]|0;if(W>>>0>15){L=X;c[16420>>2]=L+q;c[16408>>2]=W;c[L+(q+4)>>2]=W|1;c[L+M>>2]=W;c[X+4>>2]=q|3}else{c[16408>>2]=0;c[16420>>2]=0;c[X+4>>2]=M|3;W=X+(M+4)|0;c[W>>2]=c[W>>2]|1}p=X+8|0;i=b;return p|0}X=c[16412>>2]|0;if(q>>>0<X>>>0){W=X-q|0;c[16412>>2]=W;X=c[16424>>2]|0;M=X;c[16424>>2]=M+q;c[M+(q+4)>>2]=W|1;c[X+4>>2]=q|3;p=X+8|0;i=b;return p|0}do{if((c[4218]|0)==0){X=la(30)|0;if((X+ -1&X|0)==0){c[16880>>2]=X;c[16876>>2]=X;c[16884>>2]=-1;c[16888>>2]=-1;c[16892>>2]=0;c[16844>>2]=0;c[4218]=(ja(0)|0)&-16^1431655768;break}else{ga()}}}while(0);X=q+48|0;W=c[16880>>2]|0;M=q+47|0;L=W+M|0;V=0-W|0;W=L&V;if(!(W>>>0>q>>>0)){p=0;i=b;return p|0}U=c[16840>>2]|0;do{if((U|0)!=0){T=c[16832>>2]|0;S=T+W|0;if(S>>>0<=T>>>0|S>>>0>U>>>0){p=0}else{break}i=b;return p|0}}while(0);f:do{if((c[16844>>2]&4|0)==0){U=c[16424>>2]|0;g:do{if((U|0)==0){Y=182}else{S=U;T=16848|0;while(1){Z=T;P=c[Z>>2]|0;if(!(P>>>0>S>>>0)){_=T+4|0;if((P+(c[_>>2]|0)|0)>>>0>S>>>0){break}}P=c[T+8>>2]|0;if((P|0)==0){Y=182;break g}else{T=P}}if((T|0)==0){Y=182;break}S=L-(c[16412>>2]|0)&V;if(!(S>>>0<2147483647)){$=0;break}h=ia(S|0)|0;P=(h|0)==((c[Z>>2]|0)+(c[_>>2]|0)|0);aa=h;ba=S;ca=P?h:-1;da=P?S:0;Y=191}}while(0);do{if((Y|0)==182){U=ia(0)|0;if((U|0)==(-1|0)){$=0;break}S=U;P=c[16876>>2]|0;h=P+ -1|0;if((h&S|0)==0){ea=W}else{ea=W-S+(h+S&0-P)|0}P=c[16832>>2]|0;S=P+ea|0;if(!(ea>>>0>q>>>0&ea>>>0<2147483647)){$=0;break}h=c[16840>>2]|0;if((h|0)!=0){if(S>>>0<=P>>>0|S>>>0>h>>>0){$=0;break}}h=ia(ea|0)|0;S=(h|0)==(U|0);aa=h;ba=ea;ca=S?U:-1;da=S?ea:0;Y=191}}while(0);h:do{if((Y|0)==191){S=0-ba|0;if((ca|0)!=(-1|0)){fa=ca;ha=da;Y=202;break f}do{if((aa|0)!=(-1|0)&ba>>>0<2147483647&ba>>>0<X>>>0){U=c[16880>>2]|0;h=M-ba+U&0-U;if(!(h>>>0<2147483647)){ka=ba;break}if((ia(h|0)|0)==(-1|0)){ia(S|0)|0;$=da;break h}else{ka=h+ba|0;break}}else{ka=ba}}while(0);if((aa|0)==(-1|0)){$=da}else{fa=aa;ha=ka;Y=202;break f}}}while(0);c[16844>>2]=c[16844>>2]|4;na=$;Y=199}else{na=0;Y=199}}while(0);do{if((Y|0)==199){if(!(W>>>0<2147483647)){break}$=ia(W|0)|0;ka=ia(0)|0;if(!((ka|0)!=(-1|0)&($|0)!=(-1|0)&$>>>0<ka>>>0)){break}aa=ka-$|0;ka=aa>>>0>(q+40|0)>>>0;if(ka){fa=$;ha=ka?aa:na;Y=202}}}while(0);do{if((Y|0)==202){na=(c[16832>>2]|0)+ha|0;c[16832>>2]=na;if(na>>>0>(c[16836>>2]|0)>>>0){c[16836>>2]=na}na=c[16424>>2]|0;i:do{if((na|0)==0){W=c[16416>>2]|0;if((W|0)==0|fa>>>0<W>>>0){c[16416>>2]=fa}c[16848>>2]=fa;c[16852>>2]=ha;c[16860>>2]=0;c[16436>>2]=c[4218];c[16432>>2]=-1;W=0;do{aa=W<<1;ka=16440+(aa<<2)|0;c[16440+(aa+3<<2)>>2]=ka;c[16440+(aa+2<<2)>>2]=ka;W=W+1|0;}while((W|0)!=32);W=fa+8|0;if((W&7|0)==0){oa=0}else{oa=0-W&7}W=ha+ -40-oa|0;c[16424>>2]=fa+oa;c[16412>>2]=W;c[fa+(oa+4)>>2]=W|1;c[fa+(ha+ -36)>>2]=40;c[16428>>2]=c[16888>>2]}else{W=16848|0;while(1){pa=c[W>>2]|0;qa=W+4|0;ra=c[qa>>2]|0;if((fa|0)==(pa+ra|0)){Y=214;break}ka=c[W+8>>2]|0;if((ka|0)==0){break}else{W=ka}}do{if((Y|0)==214){if((c[W+12>>2]&8|0)!=0){break}ka=na;if(!(ka>>>0>=pa>>>0&ka>>>0<fa>>>0)){break}c[qa>>2]=ra+ha;aa=(c[16412>>2]|0)+ha|0;$=na+8|0;if(($&7|0)==0){sa=0}else{sa=0-$&7}$=aa-sa|0;c[16424>>2]=ka+sa;c[16412>>2]=$;c[ka+(sa+4)>>2]=$|1;c[ka+(aa+4)>>2]=40;c[16428>>2]=c[16888>>2];break i}}while(0);if(fa>>>0<(c[16416>>2]|0)>>>0){c[16416>>2]=fa}W=fa+ha|0;aa=16848|0;while(1){ta=aa;if((c[ta>>2]|0)==(W|0)){Y=224;break}ka=c[aa+8>>2]|0;if((ka|0)==0){break}else{aa=ka}}do{if((Y|0)==224){if((c[aa+12>>2]&8|0)!=0){break}c[ta>>2]=fa;W=aa+4|0;c[W>>2]=(c[W>>2]|0)+ha;W=fa+8|0;if((W&7|0)==0){ua=0}else{ua=0-W&7}W=fa+(ha+8)|0;if((W&7|0)==0){va=0}else{va=0-W&7}W=fa+(va+ha)|0;ka=W;$=ua+q|0;da=fa+$|0;ba=da;M=W-(fa+ua)-q|0;c[fa+(ua+4)>>2]=q|3;j:do{if((ka|0)==(c[16424>>2]|0)){X=(c[16412>>2]|0)+M|0;c[16412>>2]=X;c[16424>>2]=ba;c[fa+($+4)>>2]=X|1}else{if((ka|0)==(c[16420>>2]|0)){X=(c[16408>>2]|0)+M|0;c[16408>>2]=X;c[16420>>2]=ba;c[fa+($+4)>>2]=X|1;c[fa+(X+$)>>2]=X;break}X=ha+4|0;ca=c[fa+(X+va)>>2]|0;if((ca&3|0)==1){ea=ca&-8;_=ca>>>3;k:do{if(ca>>>0<256){Z=c[fa+((va|8)+ha)>>2]|0;V=c[fa+(ha+12+va)>>2]|0;L=16440+(_<<1<<2)|0;do{if((Z|0)!=(L|0)){if(Z>>>0<(c[16416>>2]|0)>>>0){ga()}if((c[Z+12>>2]|0)==(ka|0)){break}ga()}}while(0);if((V|0)==(Z|0)){c[4100]=c[4100]&~(1<<_);break}do{if((V|0)==(L|0)){wa=V+8|0}else{if(V>>>0<(c[16416>>2]|0)>>>0){ga()}S=V+8|0;if((c[S>>2]|0)==(ka|0)){wa=S;break}ga()}}while(0);c[Z+12>>2]=V;c[wa>>2]=Z}else{L=W;S=c[fa+((va|24)+ha)>>2]|0;T=c[fa+(ha+12+va)>>2]|0;do{if((T|0)==(L|0)){h=va|16;U=fa+(X+h)|0;P=c[U>>2]|0;if((P|0)==0){Q=fa+(h+ha)|0;h=c[Q>>2]|0;if((h|0)==0){xa=0;break}else{ya=h;za=Q}}else{ya=P;za=U}while(1){U=ya+20|0;P=c[U>>2]|0;if((P|0)!=0){za=U;ya=P;continue}P=ya+16|0;U=c[P>>2]|0;if((U|0)==0){break}else{ya=U;za=P}}if(za>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[za>>2]=0;xa=ya;break}}else{P=c[fa+((va|8)+ha)>>2]|0;if(P>>>0<(c[16416>>2]|0)>>>0){ga()}U=P+12|0;if((c[U>>2]|0)!=(L|0)){ga()}Q=T+8|0;if((c[Q>>2]|0)==(L|0)){c[U>>2]=T;c[Q>>2]=P;xa=T;break}else{ga()}}}while(0);if((S|0)==0){break}T=c[fa+(ha+28+va)>>2]|0;Z=16704+(T<<2)|0;do{if((L|0)==(c[Z>>2]|0)){c[Z>>2]=xa;if((xa|0)!=0){break}c[16404>>2]=c[16404>>2]&~(1<<T);break k}else{if(S>>>0<(c[16416>>2]|0)>>>0){ga()}V=S+16|0;if((c[V>>2]|0)==(L|0)){c[V>>2]=xa}else{c[S+20>>2]=xa}if((xa|0)==0){break k}}}while(0);if(xa>>>0<(c[16416>>2]|0)>>>0){ga()}c[xa+24>>2]=S;L=va|16;T=c[fa+(L+ha)>>2]|0;do{if((T|0)!=0){if(T>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[xa+16>>2]=T;c[T+24>>2]=xa;break}}}while(0);T=c[fa+(X+L)>>2]|0;if((T|0)==0){break}if(T>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[xa+20>>2]=T;c[T+24>>2]=xa;break}}}while(0);Aa=fa+((ea|va)+ha)|0;Ba=ea+M|0}else{Aa=ka;Ba=M}X=Aa+4|0;c[X>>2]=c[X>>2]&-2;c[fa+($+4)>>2]=Ba|1;c[fa+(Ba+$)>>2]=Ba;X=Ba>>>3;if(Ba>>>0<256){_=X<<1;ca=16440+(_<<2)|0;T=c[4100]|0;S=1<<X;do{if((T&S|0)==0){c[4100]=T|S;Ca=16440+(_+2<<2)|0;Da=ca}else{X=16440+(_+2<<2)|0;Z=c[X>>2]|0;if(!(Z>>>0<(c[16416>>2]|0)>>>0)){Ca=X;Da=Z;break}ga()}}while(0);c[Ca>>2]=ba;c[Da+12>>2]=ba;c[fa+($+8)>>2]=Da;c[fa+($+12)>>2]=ca;break}_=da;S=Ba>>>8;do{if((S|0)==0){Ea=0}else{if(Ba>>>0>16777215){Ea=31;break}T=(S+1048320|0)>>>16&8;ea=S<<T;Z=(ea+520192|0)>>>16&4;X=ea<<Z;ea=(X+245760|0)>>>16&2;V=14-(Z|T|ea)+(X<<ea>>>15)|0;Ea=Ba>>>(V+7|0)&1|V<<1}}while(0);S=16704+(Ea<<2)|0;c[fa+($+28)>>2]=Ea;c[fa+($+20)>>2]=0;c[fa+($+16)>>2]=0;ca=c[16404>>2]|0;V=1<<Ea;if((ca&V|0)==0){c[16404>>2]=ca|V;c[S>>2]=_;c[fa+($+24)>>2]=S;c[fa+($+12)>>2]=_;c[fa+($+8)>>2]=_;break}V=c[S>>2]|0;if((Ea|0)==31){Fa=0}else{Fa=25-(Ea>>>1)|0}l:do{if((c[V+4>>2]&-8|0)==(Ba|0)){Ga=V}else{S=Ba<<Fa;ca=V;while(1){Ha=ca+(S>>>31<<2)+16|0;ea=c[Ha>>2]|0;if((ea|0)==0){break}if((c[ea+4>>2]&-8|0)==(Ba|0)){Ga=ea;break l}else{S=S<<1;ca=ea}}if(Ha>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[Ha>>2]=_;c[fa+($+24)>>2]=ca;c[fa+($+12)>>2]=_;c[fa+($+8)>>2]=_;break j}}}while(0);V=Ga+8|0;S=c[V>>2]|0;L=c[16416>>2]|0;if(Ga>>>0<L>>>0){ga()}if(S>>>0<L>>>0){ga()}else{c[S+12>>2]=_;c[V>>2]=_;c[fa+($+8)>>2]=S;c[fa+($+12)>>2]=Ga;c[fa+($+24)>>2]=0;break}}}while(0);p=fa+(ua|8)|0;i=b;return p|0}}while(0);aa=na;$=16848|0;while(1){Ia=c[$>>2]|0;if(!(Ia>>>0>aa>>>0)){Ja=c[$+4>>2]|0;Ka=Ia+Ja|0;if(Ka>>>0>aa>>>0){break}}$=c[$+8>>2]|0}$=Ia+(Ja+ -39)|0;if(($&7|0)==0){La=0}else{La=0-$&7}$=Ia+(Ja+ -47+La)|0;da=$>>>0<(na+16|0)>>>0?aa:$;$=da+8|0;ba=$;M=fa+8|0;if((M&7|0)==0){Ma=0}else{Ma=0-M&7}M=ha+ -40-Ma|0;c[16424>>2]=fa+Ma;c[16412>>2]=M;c[fa+(Ma+4)>>2]=M|1;c[fa+(ha+ -36)>>2]=40;c[16428>>2]=c[16888>>2];c[da+4>>2]=27;c[$+0>>2]=c[16848>>2];c[$+4>>2]=c[16852>>2];c[$+8>>2]=c[16856>>2];c[$+12>>2]=c[16860>>2];c[16848>>2]=fa;c[16852>>2]=ha;c[16860>>2]=0;c[16856>>2]=ba;ba=da+28|0;c[ba>>2]=7;if((da+32|0)>>>0<Ka>>>0){$=ba;while(1){ba=$+4|0;c[ba>>2]=7;if(($+8|0)>>>0<Ka>>>0){$=ba}else{break}}}if((da|0)==(aa|0)){break}$=da-na|0;ba=aa+($+4)|0;c[ba>>2]=c[ba>>2]&-2;c[na+4>>2]=$|1;c[aa+$>>2]=$;ba=$>>>3;if($>>>0<256){M=ba<<1;ka=16440+(M<<2)|0;W=c[4100]|0;m=1<<ba;do{if((W&m|0)==0){c[4100]=W|m;Na=16440+(M+2<<2)|0;Oa=ka}else{ba=16440+(M+2<<2)|0;S=c[ba>>2]|0;if(!(S>>>0<(c[16416>>2]|0)>>>0)){Na=ba;Oa=S;break}ga()}}while(0);c[Na>>2]=na;c[Oa+12>>2]=na;c[na+8>>2]=Oa;c[na+12>>2]=ka;break}M=na;m=$>>>8;do{if((m|0)==0){Pa=0}else{if($>>>0>16777215){Pa=31;break}W=(m+1048320|0)>>>16&8;aa=m<<W;da=(aa+520192|0)>>>16&4;S=aa<<da;aa=(S+245760|0)>>>16&2;ba=14-(da|W|aa)+(S<<aa>>>15)|0;Pa=$>>>(ba+7|0)&1|ba<<1}}while(0);m=16704+(Pa<<2)|0;c[na+28>>2]=Pa;c[na+20>>2]=0;c[na+16>>2]=0;ka=c[16404>>2]|0;ba=1<<Pa;if((ka&ba|0)==0){c[16404>>2]=ka|ba;c[m>>2]=M;c[na+24>>2]=m;c[na+12>>2]=na;c[na+8>>2]=na;break}ba=c[m>>2]|0;if((Pa|0)==31){Qa=0}else{Qa=25-(Pa>>>1)|0}m:do{if((c[ba+4>>2]&-8|0)==($|0)){Ra=ba}else{m=$<<Qa;ka=ba;while(1){Sa=ka+(m>>>31<<2)+16|0;aa=c[Sa>>2]|0;if((aa|0)==0){break}if((c[aa+4>>2]&-8|0)==($|0)){Ra=aa;break m}else{m=m<<1;ka=aa}}if(Sa>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[Sa>>2]=M;c[na+24>>2]=ka;c[na+12>>2]=na;c[na+8>>2]=na;break i}}}while(0);$=Ra+8|0;ba=c[$>>2]|0;m=c[16416>>2]|0;if(Ra>>>0<m>>>0){ga()}if(ba>>>0<m>>>0){ga()}else{c[ba+12>>2]=M;c[$>>2]=M;c[na+8>>2]=ba;c[na+12>>2]=Ra;c[na+24>>2]=0;break}}}while(0);na=c[16412>>2]|0;if(!(na>>>0>q>>>0)){break}ba=na-q|0;c[16412>>2]=ba;na=c[16424>>2]|0;$=na;c[16424>>2]=$+q;c[$+(q+4)>>2]=ba|1;c[na+4>>2]=q|3;p=na+8|0;i=b;return p|0}}while(0);c[(ma()|0)>>2]=12;p=0;i=b;return p|0}function Qa(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0;b=i;if((a|0)==0){i=b;return}d=a+ -8|0;e=d;f=c[16416>>2]|0;if(d>>>0<f>>>0){ga()}g=c[a+ -4>>2]|0;h=g&3;if((h|0)==1){ga()}j=g&-8;k=a+(j+ -8)|0;l=k;a:do{if((g&1|0)==0){m=c[d>>2]|0;if((h|0)==0){i=b;return}n=-8-m|0;o=a+n|0;p=o;q=m+j|0;if(o>>>0<f>>>0){ga()}if((p|0)==(c[16420>>2]|0)){r=a+(j+ -4)|0;if((c[r>>2]&3|0)!=3){s=p;t=q;break}c[16408>>2]=q;c[r>>2]=c[r>>2]&-2;c[a+(n+4)>>2]=q|1;c[k>>2]=q;i=b;return}r=m>>>3;if(m>>>0<256){m=c[a+(n+8)>>2]|0;u=c[a+(n+12)>>2]|0;v=16440+(r<<1<<2)|0;do{if((m|0)!=(v|0)){if(m>>>0<f>>>0){ga()}if((c[m+12>>2]|0)==(p|0)){break}ga()}}while(0);if((u|0)==(m|0)){c[4100]=c[4100]&~(1<<r);s=p;t=q;break}do{if((u|0)==(v|0)){w=u+8|0}else{if(u>>>0<f>>>0){ga()}x=u+8|0;if((c[x>>2]|0)==(p|0)){w=x;break}ga()}}while(0);c[m+12>>2]=u;c[w>>2]=m;s=p;t=q;break}v=o;r=c[a+(n+24)>>2]|0;x=c[a+(n+12)>>2]|0;do{if((x|0)==(v|0)){y=a+(n+20)|0;z=c[y>>2]|0;if((z|0)==0){A=a+(n+16)|0;B=c[A>>2]|0;if((B|0)==0){C=0;break}else{D=B;E=A}}else{D=z;E=y}while(1){y=D+20|0;z=c[y>>2]|0;if((z|0)!=0){E=y;D=z;continue}z=D+16|0;y=c[z>>2]|0;if((y|0)==0){break}else{D=y;E=z}}if(E>>>0<f>>>0){ga()}else{c[E>>2]=0;C=D;break}}else{z=c[a+(n+8)>>2]|0;if(z>>>0<f>>>0){ga()}y=z+12|0;if((c[y>>2]|0)!=(v|0)){ga()}A=x+8|0;if((c[A>>2]|0)==(v|0)){c[y>>2]=x;c[A>>2]=z;C=x;break}else{ga()}}}while(0);if((r|0)==0){s=p;t=q;break}x=c[a+(n+28)>>2]|0;o=16704+(x<<2)|0;do{if((v|0)==(c[o>>2]|0)){c[o>>2]=C;if((C|0)!=0){break}c[16404>>2]=c[16404>>2]&~(1<<x);s=p;t=q;break a}else{if(r>>>0<(c[16416>>2]|0)>>>0){ga()}m=r+16|0;if((c[m>>2]|0)==(v|0)){c[m>>2]=C}else{c[r+20>>2]=C}if((C|0)==0){s=p;t=q;break a}}}while(0);if(C>>>0<(c[16416>>2]|0)>>>0){ga()}c[C+24>>2]=r;v=c[a+(n+16)>>2]|0;do{if((v|0)!=0){if(v>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[C+16>>2]=v;c[v+24>>2]=C;break}}}while(0);v=c[a+(n+20)>>2]|0;if((v|0)==0){s=p;t=q;break}if(v>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[C+20>>2]=v;c[v+24>>2]=C;s=p;t=q;break}}else{s=e;t=j}}while(0);e=s;if(!(e>>>0<k>>>0)){ga()}C=a+(j+ -4)|0;f=c[C>>2]|0;if((f&1|0)==0){ga()}do{if((f&2|0)==0){if((l|0)==(c[16424>>2]|0)){D=(c[16412>>2]|0)+t|0;c[16412>>2]=D;c[16424>>2]=s;c[s+4>>2]=D|1;if((s|0)!=(c[16420>>2]|0)){i=b;return}c[16420>>2]=0;c[16408>>2]=0;i=b;return}if((l|0)==(c[16420>>2]|0)){D=(c[16408>>2]|0)+t|0;c[16408>>2]=D;c[16420>>2]=s;c[s+4>>2]=D|1;c[e+D>>2]=D;i=b;return}D=(f&-8)+t|0;E=f>>>3;b:do{if(f>>>0<256){w=c[a+j>>2]|0;h=c[a+(j|4)>>2]|0;d=16440+(E<<1<<2)|0;do{if((w|0)!=(d|0)){if(w>>>0<(c[16416>>2]|0)>>>0){ga()}if((c[w+12>>2]|0)==(l|0)){break}ga()}}while(0);if((h|0)==(w|0)){c[4100]=c[4100]&~(1<<E);break}do{if((h|0)==(d|0)){F=h+8|0}else{if(h>>>0<(c[16416>>2]|0)>>>0){ga()}g=h+8|0;if((c[g>>2]|0)==(l|0)){F=g;break}ga()}}while(0);c[w+12>>2]=h;c[F>>2]=w}else{d=k;g=c[a+(j+16)>>2]|0;v=c[a+(j|4)>>2]|0;do{if((v|0)==(d|0)){r=a+(j+12)|0;x=c[r>>2]|0;if((x|0)==0){o=a+(j+8)|0;m=c[o>>2]|0;if((m|0)==0){G=0;break}else{H=m;I=o}}else{H=x;I=r}while(1){r=H+20|0;x=c[r>>2]|0;if((x|0)!=0){I=r;H=x;continue}x=H+16|0;r=c[x>>2]|0;if((r|0)==0){break}else{H=r;I=x}}if(I>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[I>>2]=0;G=H;break}}else{x=c[a+j>>2]|0;if(x>>>0<(c[16416>>2]|0)>>>0){ga()}r=x+12|0;if((c[r>>2]|0)!=(d|0)){ga()}o=v+8|0;if((c[o>>2]|0)==(d|0)){c[r>>2]=v;c[o>>2]=x;G=v;break}else{ga()}}}while(0);if((g|0)==0){break}v=c[a+(j+20)>>2]|0;w=16704+(v<<2)|0;do{if((d|0)==(c[w>>2]|0)){c[w>>2]=G;if((G|0)!=0){break}c[16404>>2]=c[16404>>2]&~(1<<v);break b}else{if(g>>>0<(c[16416>>2]|0)>>>0){ga()}h=g+16|0;if((c[h>>2]|0)==(d|0)){c[h>>2]=G}else{c[g+20>>2]=G}if((G|0)==0){break b}}}while(0);if(G>>>0<(c[16416>>2]|0)>>>0){ga()}c[G+24>>2]=g;d=c[a+(j+8)>>2]|0;do{if((d|0)!=0){if(d>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[G+16>>2]=d;c[d+24>>2]=G;break}}}while(0);d=c[a+(j+12)>>2]|0;if((d|0)==0){break}if(d>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[G+20>>2]=d;c[d+24>>2]=G;break}}}while(0);c[s+4>>2]=D|1;c[e+D>>2]=D;if((s|0)!=(c[16420>>2]|0)){J=D;break}c[16408>>2]=D;i=b;return}else{c[C>>2]=f&-2;c[s+4>>2]=t|1;c[e+t>>2]=t;J=t}}while(0);t=J>>>3;if(J>>>0<256){e=t<<1;f=16440+(e<<2)|0;C=c[4100]|0;G=1<<t;do{if((C&G|0)==0){c[4100]=C|G;K=16440+(e+2<<2)|0;L=f}else{t=16440+(e+2<<2)|0;j=c[t>>2]|0;if(!(j>>>0<(c[16416>>2]|0)>>>0)){K=t;L=j;break}ga()}}while(0);c[K>>2]=s;c[L+12>>2]=s;c[s+8>>2]=L;c[s+12>>2]=f;i=b;return}f=s;L=J>>>8;do{if((L|0)==0){M=0}else{if(J>>>0>16777215){M=31;break}K=(L+1048320|0)>>>16&8;e=L<<K;G=(e+520192|0)>>>16&4;C=e<<G;e=(C+245760|0)>>>16&2;j=14-(G|K|e)+(C<<e>>>15)|0;M=J>>>(j+7|0)&1|j<<1}}while(0);L=16704+(M<<2)|0;c[s+28>>2]=M;c[s+20>>2]=0;c[s+16>>2]=0;j=c[16404>>2]|0;e=1<<M;c:do{if((j&e|0)==0){c[16404>>2]=j|e;c[L>>2]=f;c[s+24>>2]=L;c[s+12>>2]=s;c[s+8>>2]=s}else{C=c[L>>2]|0;if((M|0)==31){N=0}else{N=25-(M>>>1)|0}d:do{if((c[C+4>>2]&-8|0)==(J|0)){O=C}else{K=J<<N;G=C;while(1){P=G+(K>>>31<<2)+16|0;t=c[P>>2]|0;if((t|0)==0){break}if((c[t+4>>2]&-8|0)==(J|0)){O=t;break d}else{K=K<<1;G=t}}if(P>>>0<(c[16416>>2]|0)>>>0){ga()}else{c[P>>2]=f;c[s+24>>2]=G;c[s+12>>2]=s;c[s+8>>2]=s;break c}}}while(0);C=O+8|0;D=c[C>>2]|0;K=c[16416>>2]|0;if(O>>>0<K>>>0){ga()}if(D>>>0<K>>>0){ga()}else{c[D+12>>2]=f;c[C>>2]=f;c[s+8>>2]=D;c[s+12>>2]=O;c[s+24>>2]=0;break}}}while(0);s=(c[16432>>2]|0)+ -1|0;c[16432>>2]=s;if((s|0)==0){Q=16856|0}else{i=b;return}while(1){s=c[Q>>2]|0;if((s|0)==0){break}else{Q=s+8|0}}c[16432>>2]=-1;i=b;return}function Ra(){}function Sa(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return(D=b+d+(e>>>0<a>>>0|0)>>>0,e|0)|0}function Ta(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;if((e|0)>=20){d=d&255;g=b&3;h=d|d<<8|d<<16|d<<24;i=f&~3;if(g){g=b+4-g|0;while((b|0)<(g|0)){a[b]=d;b=b+1|0}}while((b|0)<(i|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b]=d;b=b+1|0}return b-e|0}function Ua(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){D=b>>>c;return a>>>c|(b&(1<<c)-1)<<32-c}D=0;return b>>>c-32|0}function Va(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){D=b<<c|(a&(1<<c)-1<<32-c)>>>32-c;return a<<c}D=a<<c-32;return 0}function Wa(b){b=b|0;var c=0;c=b;while(a[c]|0){c=c+1|0}return c-b|0}function Xa(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;if((e|0)>=4096)return ka(b|0,d|0,e|0)|0;f=b|0;if((b&3)==(d&3)){while(b&3){if((e|0)==0)return f|0;a[b]=a[d]|0;b=b+1|0;d=d+1|0;e=e-1|0}while((e|0)>=4){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0;e=e-4|0}}while((e|0)>0){a[b]=a[d]|0;b=b+1|0;d=d+1|0;e=e-1|0}return f|0}function Ya(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return(D=e,a-c>>>0|0)|0}function Za(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){D=b>>c;return a>>>c|(b&(1<<c)-1)<<32-c}D=(b|0)<0?-1:0;return b>>c-32|0}function _a(b){b=b|0;var c=0;c=a[n+(b>>>24)|0]|0;if((c|0)<8)return c|0;c=a[n+(b>>16&255)|0]|0;if((c|0)<8)return c+8|0;c=a[n+(b>>8&255)|0]|0;if((c|0)<8)return c+16|0;return(a[n+(b&255)|0]|0)+24|0}function $a(b){b=b|0;var c=0;c=a[m+(b&255)|0]|0;if((c|0)<8)return c|0;c=a[m+(b>>8&255)|0]|0;if((c|0)<8)return c+8|0;c=a[m+(b>>16&255)|0]|0;if((c|0)<8)return c+16|0;return(a[m+(b>>>24)|0]|0)+24|0}function ab(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=$(d,c)|0;f=a>>>16;a=(e>>>16)+($(d,f)|0)|0;d=b>>>16;b=$(d,c)|0;return(D=(a>>>16)+($(d,f)|0)+(((a&65535)+b|0)>>>16)|0,a+b<<16|e&65535|0)|0}function bb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0;e=b>>31|((b|0)<0?-1:0)<<1;f=((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1;g=d>>31|((d|0)<0?-1:0)<<1;h=((d|0)<0?-1:0)>>31|((d|0)<0?-1:0)<<1;i=Ya(e^a,f^b,e,f)|0;b=D;a=g^e;e=h^f;f=Ya((gb(i,b,Ya(g^c,h^d,g,h)|0,D,0)|0)^a,D^e,a,e)|0;return(D=D,f)|0}function cb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,j=0,k=0,l=0,m=0;f=i;i=i+8|0;g=f|0;h=b>>31|((b|0)<0?-1:0)<<1;j=((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1;k=e>>31|((e|0)<0?-1:0)<<1;l=((e|0)<0?-1:0)>>31|((e|0)<0?-1:0)<<1;m=Ya(h^a,j^b,h,j)|0;b=D;gb(m,b,Ya(k^d,l^e,k,l)|0,D,g)|0;l=Ya(c[g>>2]^h,c[g+4>>2]^j,h,j)|0;j=D;i=f;return(D=j,l)|0}function db(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=ab(e,a)|0;f=D;return(D=($(b,a)|0)+($(d,e)|0)+f|f&0,c|0|0)|0}function eb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=gb(a,b,c,d,0)|0;return(D=D,e)|0}function fb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;f=i;i=i+8|0;g=f|0;gb(a,b,d,e,g)|0;i=f;return(D=c[g+4>>2]|0,c[g>>2]|0)|0}function gb(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0;g=a;h=b;i=h;j=d;k=e;l=k;if((i|0)==0){m=(f|0)!=0;if((l|0)==0){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return(D=n,o)|0}else{if(!m){n=0;o=0;return(D=n,o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return(D=n,o)|0}}m=(l|0)==0;do{if((j|0)==0){if(m){if((f|0)!=0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return(D=n,o)|0}if((g|0)==0){if((f|0)!=0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return(D=n,o)|0}p=l-1|0;if((p&l|0)==0){if((f|0)!=0){c[f>>2]=a|0;c[f+4>>2]=p&i|b&0}n=0;o=i>>>(($a(l|0)|0)>>>0);return(D=n,o)|0}p=(_a(l|0)|0)-(_a(i|0)|0)|0;if(p>>>0<=30){q=p+1|0;r=31-p|0;s=q;t=i<<r|g>>>(q>>>0);u=i>>>(q>>>0);v=0;w=g<<r;break}if((f|0)==0){n=0;o=0;return(D=n,o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return(D=n,o)|0}else{if(!m){r=(_a(l|0)|0)-(_a(i|0)|0)|0;if(r>>>0<=31){q=r+1|0;p=31-r|0;x=r-31>>31;s=q;t=g>>>(q>>>0)&x|i<<p;u=i>>>(q>>>0)&x;v=0;w=g<<p;break}if((f|0)==0){n=0;o=0;return(D=n,o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return(D=n,o)|0}p=j-1|0;if((p&j|0)!=0){x=(_a(j|0)|0)+33-(_a(i|0)|0)|0;q=64-x|0;r=32-x|0;y=r>>31;z=x-32|0;A=z>>31;s=x;t=r-1>>31&i>>>(z>>>0)|(i<<r|g>>>(x>>>0))&A;u=A&i>>>(x>>>0);v=g<<q&y;w=(i<<q|g>>>(z>>>0))&y|g<<r&x-33>>31;break}if((f|0)!=0){c[f>>2]=p&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return(D=n,o)|0}else{p=$a(j|0)|0;n=i>>>(p>>>0)|0;o=i<<32-p|g>>>(p>>>0)|0;return(D=n,o)|0}}}while(0);if((s|0)==0){B=w;C=v;E=u;F=t;G=0;H=0}else{g=d|0|0;d=k|e&0;e=Sa(g,d,-1,-1)|0;k=D;i=w;w=v;v=u;u=t;t=s;s=0;while(1){I=w>>>31|i<<1;J=s|w<<1;j=u<<1|i>>>31|0;a=u>>>31|v<<1|0;Ya(e,k,j,a)|0;b=D;h=b>>31|((b|0)<0?-1:0)<<1;K=h&1;L=Ya(j,a,h&g,(((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1)&d)|0;M=D;b=t-1|0;if((b|0)==0){break}else{i=I;w=J;v=M;u=L;t=b;s=K}}B=I;C=J;E=M;F=L;G=0;H=K}K=C;C=0;if((f|0)!=0){c[f>>2]=F;c[f+4>>2]=E}n=(K|0)>>>31|(B|C)<<1|(C<<1|K>>>31)&0|G;o=(K<<1|0>>>31)&-2|H;return(D=n,o)|0}




// EMSCRIPTEN_END_FUNCS
    return{_strlen:Wa,_free:Qa,_i64Add:Sa,_memset:Ta,_malloc:Pa,_memcpy:Xa,_bitshift64Lshr:Ua,_GroestlCoinHash:Ga,_bitshift64Shl:Va,runPostSets:Ra,stackAlloc:oa,stackSave:pa,stackRestore:qa,setThrew:ra,setTempRet0:ua,setTempRet1:va,setTempRet2:wa,setTempRet3:xa,setTempRet4:ya,setTempRet5:za,setTempRet6:Aa,setTempRet7:Ba,setTempRet8:Ca,setTempRet9:Da}})


// EMSCRIPTEN_END_ASM
({ "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array }, { "abort": abort, "assert": assert, "asmPrintInt": asmPrintInt, "asmPrintFloat": asmPrintFloat, "min": Math_min, "_fflush": _fflush, "_abort": _abort, "___setErrNo": ___setErrNo, "_sbrk": _sbrk, "_time": _time, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_sysconf": _sysconf, "___errno_location": ___errno_location, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8, "ctlz_i8": ctlz_i8, "NaN": NaN, "Infinity": Infinity }, buffer);
var _strlen = Module["_strlen"] = asm["_strlen"];
var _free = Module["_free"] = asm["_free"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _memset = Module["_memset"] = asm["_memset"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _GroestlCoinHash = Module["_GroestlCoinHash"] = asm["_GroestlCoinHash"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];

Runtime.stackAlloc = function(size) { return asm['stackAlloc'](size) };
Runtime.stackSave = function() { return asm['stackSave']() };
Runtime.stackRestore = function(top) { asm['stackRestore'](top) };


// TODO: strip out parts of this we do not need

//======= begin closure i64 code =======

// Copyright 2009 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Defines a Long class for representing a 64-bit two's-complement
 * integer value, which faithfully simulates the behavior of a Java "long". This
 * implementation is derived from LongLib in GWT.
 *
 */

var i64Math = (function() { // Emscripten wrapper
    var goog = { math: {} };


    /**
     * Constructs a 64-bit two's-complement integer, given its low and high 32-bit
     * values as *signed* integers.  See the from* functions below for more
     * convenient ways of constructing Longs.
     *
     * The internal representation of a long is the two given signed, 32-bit values.
     * We use 32-bit pieces because these are the size of integers on which
     * Javascript performs bit-operations.  For operations like addition and
     * multiplication, we split each number into 16-bit pieces, which can easily be
     * multiplied within Javascript's floating-point representation without overflow
     * or change in sign.
     *
     * In the algorithms below, we frequently reduce the negative case to the
     * positive case by negating the input(s) and then post-processing the result.
     * Note that we must ALWAYS check specially whether those values are MIN_VALUE
     * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
     * a positive number, it overflows back into a negative).  Not handling this
     * case would often result in infinite recursion.
     *
     * @param {number} low  The low (signed) 32 bits of the long.
     * @param {number} high  The high (signed) 32 bits of the long.
     * @constructor
     */
    goog.math.Long = function(low, high) {
        /**
         * @type {number}
         * @private
         */
        this.low_ = low | 0;  // force into 32 signed bits.

        /**
         * @type {number}
         * @private
         */
        this.high_ = high | 0;  // force into 32 signed bits.
    };


    // NOTE: Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the
    // from* methods on which they depend.


    /**
     * A cache of the Long representations of small integer values.
     * @type {!Object}
     * @private
     */
    goog.math.Long.IntCache_ = {};


    /**
     * Returns a Long representing the given (32-bit) integer value.
     * @param {number} value The 32-bit integer in question.
     * @return {!goog.math.Long} The corresponding Long value.
     */
    goog.math.Long.fromInt = function(value) {
        if (-128 <= value && value < 128) {
            var cachedObj = goog.math.Long.IntCache_[value];
            if (cachedObj) {
                return cachedObj;
            }
        }

        var obj = new goog.math.Long(value | 0, value < 0 ? -1 : 0);
        if (-128 <= value && value < 128) {
            goog.math.Long.IntCache_[value] = obj;
        }
        return obj;
    };


    /**
     * Returns a Long representing the given value, provided that it is a finite
     * number.  Otherwise, zero is returned.
     * @param {number} value The number in question.
     * @return {!goog.math.Long} The corresponding Long value.
     */
    goog.math.Long.fromNumber = function(value) {
        if (isNaN(value) || !isFinite(value)) {
            return goog.math.Long.ZERO;
        } else if (value <= -goog.math.Long.TWO_PWR_63_DBL_) {
            return goog.math.Long.MIN_VALUE;
        } else if (value + 1 >= goog.math.Long.TWO_PWR_63_DBL_) {
            return goog.math.Long.MAX_VALUE;
        } else if (value < 0) {
            return goog.math.Long.fromNumber(-value).negate();
        } else {
            return new goog.math.Long(
                (value % goog.math.Long.TWO_PWR_32_DBL_) | 0,
                (value / goog.math.Long.TWO_PWR_32_DBL_) | 0);
        }
    };


    /**
     * Returns a Long representing the 64-bit integer that comes by concatenating
     * the given high and low bits.  Each is assumed to use 32 bits.
     * @param {number} lowBits The low 32-bits.
     * @param {number} highBits The high 32-bits.
     * @return {!goog.math.Long} The corresponding Long value.
     */
    goog.math.Long.fromBits = function(lowBits, highBits) {
        return new goog.math.Long(lowBits, highBits);
    };


    /**
     * Returns a Long representation of the given string, written using the given
     * radix.
     * @param {string} str The textual representation of the Long.
     * @param {number=} opt_radix The radix in which the text is written.
     * @return {!goog.math.Long} The corresponding Long value.
     */
    goog.math.Long.fromString = function(str, opt_radix) {
        if (str.length == 0) {
            throw Error('number format error: empty string');
        }

        var radix = opt_radix || 10;
        if (radix < 2 || 36 < radix) {
            throw Error('radix out of range: ' + radix);
        }

        if (str.charAt(0) == '-') {
            return goog.math.Long.fromString(str.substring(1), radix).negate();
        } else if (str.indexOf('-') >= 0) {
            throw Error('number format error: interior "-" character: ' + str);
        }

        // Do several (8) digits each time through the loop, so as to
        // minimize the calls to the very expensive emulated div.
        var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 8));

        var result = goog.math.Long.ZERO;
        for (var i = 0; i < str.length; i += 8) {
            var size = Math.min(8, str.length - i);
            var value = parseInt(str.substring(i, i + size), radix);
            if (size < 8) {
                var power = goog.math.Long.fromNumber(Math.pow(radix, size));
                result = result.multiply(power).add(goog.math.Long.fromNumber(value));
            } else {
                result = result.multiply(radixToPower);
                result = result.add(goog.math.Long.fromNumber(value));
            }
        }
        return result;
    };


    // NOTE: the compiler should inline these constant values below and then remove
    // these variables, so there should be no runtime penalty for these.


    /**
     * Number used repeated below in calculations.  This must appear before the
     * first call to any from* function below.
     * @type {number}
     * @private
     */
    goog.math.Long.TWO_PWR_16_DBL_ = 1 << 16;


    /**
     * @type {number}
     * @private
     */
    goog.math.Long.TWO_PWR_24_DBL_ = 1 << 24;


    /**
     * @type {number}
     * @private
     */
    goog.math.Long.TWO_PWR_32_DBL_ =
        goog.math.Long.TWO_PWR_16_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;


    /**
     * @type {number}
     * @private
     */
    goog.math.Long.TWO_PWR_31_DBL_ =
        goog.math.Long.TWO_PWR_32_DBL_ / 2;


    /**
     * @type {number}
     * @private
     */
    goog.math.Long.TWO_PWR_48_DBL_ =
        goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;


    /**
     * @type {number}
     * @private
     */
    goog.math.Long.TWO_PWR_64_DBL_ =
        goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_32_DBL_;


    /**
     * @type {number}
     * @private
     */
    goog.math.Long.TWO_PWR_63_DBL_ =
        goog.math.Long.TWO_PWR_64_DBL_ / 2;


    /** @type {!goog.math.Long} */
    goog.math.Long.ZERO = goog.math.Long.fromInt(0);


    /** @type {!goog.math.Long} */
    goog.math.Long.ONE = goog.math.Long.fromInt(1);


    /** @type {!goog.math.Long} */
    goog.math.Long.NEG_ONE = goog.math.Long.fromInt(-1);


    /** @type {!goog.math.Long} */
    goog.math.Long.MAX_VALUE =
        goog.math.Long.fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0);


    /** @type {!goog.math.Long} */
    goog.math.Long.MIN_VALUE = goog.math.Long.fromBits(0, 0x80000000 | 0);


    /**
     * @type {!goog.math.Long}
     * @private
     */
    goog.math.Long.TWO_PWR_24_ = goog.math.Long.fromInt(1 << 24);


    /** @return {number} The value, assuming it is a 32-bit integer. */
    goog.math.Long.prototype.toInt = function() {
        return this.low_;
    };


    /** @return {number} The closest floating-point representation to this value. */
    goog.math.Long.prototype.toNumber = function() {
        return this.high_ * goog.math.Long.TWO_PWR_32_DBL_ +
            this.getLowBitsUnsigned();
    };


    /**
     * @param {number=} opt_radix The radix in which the text should be written.
     * @return {string} The textual representation of this value.
     */
    goog.math.Long.prototype.toString = function(opt_radix) {
        var radix = opt_radix || 10;
        if (radix < 2 || 36 < radix) {
            throw Error('radix out of range: ' + radix);
        }

        if (this.isZero()) {
            return '0';
        }

        if (this.isNegative()) {
            if (this.equals(goog.math.Long.MIN_VALUE)) {
                // We need to change the Long value before it can be negated, so we remove
                // the bottom-most digit in this base and then recurse to do the rest.
                var radixLong = goog.math.Long.fromNumber(radix);
                var div = this.div(radixLong);
                var rem = div.multiply(radixLong).subtract(this);
                return div.toString(radix) + rem.toInt().toString(radix);
            } else {
                return '-' + this.negate().toString(radix);
            }
        }

        // Do several (6) digits each time through the loop, so as to
        // minimize the calls to the very expensive emulated div.
        var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 6));

        var rem = this;
        var result = '';
        while (true) {
            var remDiv = rem.div(radixToPower);
            var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
            var digits = intval.toString(radix);

            rem = remDiv;
            if (rem.isZero()) {
                return digits + result;
            } else {
                while (digits.length < 6) {
                    digits = '0' + digits;
                }
                result = '' + digits + result;
            }
        }
    };


    /** @return {number} The high 32-bits as a signed value. */
    goog.math.Long.prototype.getHighBits = function() {
        return this.high_;
    };


    /** @return {number} The low 32-bits as a signed value. */
    goog.math.Long.prototype.getLowBits = function() {
        return this.low_;
    };


    /** @return {number} The low 32-bits as an unsigned value. */
    goog.math.Long.prototype.getLowBitsUnsigned = function() {
        return (this.low_ >= 0) ?
            this.low_ : goog.math.Long.TWO_PWR_32_DBL_ + this.low_;
    };


    /**
     * @return {number} Returns the number of bits needed to represent the absolute
     *     value of this Long.
     */
    goog.math.Long.prototype.getNumBitsAbs = function() {
        if (this.isNegative()) {
            if (this.equals(goog.math.Long.MIN_VALUE)) {
                return 64;
            } else {
                return this.negate().getNumBitsAbs();
            }
        } else {
            var val = this.high_ != 0 ? this.high_ : this.low_;
            for (var bit = 31; bit > 0; bit--) {
                if ((val & (1 << bit)) != 0) {
                    break;
                }
            }
            return this.high_ != 0 ? bit + 33 : bit + 1;
        }
    };


    /** @return {boolean} Whether this value is zero. */
    goog.math.Long.prototype.isZero = function() {
        return this.high_ == 0 && this.low_ == 0;
    };


    /** @return {boolean} Whether this value is negative. */
    goog.math.Long.prototype.isNegative = function() {
        return this.high_ < 0;
    };


    /** @return {boolean} Whether this value is odd. */
    goog.math.Long.prototype.isOdd = function() {
        return (this.low_ & 1) == 1;
    };


    /**
     * @param {goog.math.Long} other Long to compare against.
     * @return {boolean} Whether this Long equals the other.
     */
    goog.math.Long.prototype.equals = function(other) {
        return (this.high_ == other.high_) && (this.low_ == other.low_);
    };


    /**
     * @param {goog.math.Long} other Long to compare against.
     * @return {boolean} Whether this Long does not equal the other.
     */
    goog.math.Long.prototype.notEquals = function(other) {
        return (this.high_ != other.high_) || (this.low_ != other.low_);
    };


    /**
     * @param {goog.math.Long} other Long to compare against.
     * @return {boolean} Whether this Long is less than the other.
     */
    goog.math.Long.prototype.lessThan = function(other) {
        return this.compare(other) < 0;
    };


    /**
     * @param {goog.math.Long} other Long to compare against.
     * @return {boolean} Whether this Long is less than or equal to the other.
     */
    goog.math.Long.prototype.lessThanOrEqual = function(other) {
        return this.compare(other) <= 0;
    };


    /**
     * @param {goog.math.Long} other Long to compare against.
     * @return {boolean} Whether this Long is greater than the other.
     */
    goog.math.Long.prototype.greaterThan = function(other) {
        return this.compare(other) > 0;
    };


    /**
     * @param {goog.math.Long} other Long to compare against.
     * @return {boolean} Whether this Long is greater than or equal to the other.
     */
    goog.math.Long.prototype.greaterThanOrEqual = function(other) {
        return this.compare(other) >= 0;
    };


    /**
     * Compares this Long with the given one.
     * @param {goog.math.Long} other Long to compare against.
     * @return {number} 0 if they are the same, 1 if the this is greater, and -1
     *     if the given one is greater.
     */
    goog.math.Long.prototype.compare = function(other) {
        if (this.equals(other)) {
            return 0;
        }

        var thisNeg = this.isNegative();
        var otherNeg = other.isNegative();
        if (thisNeg && !otherNeg) {
            return -1;
        }
        if (!thisNeg && otherNeg) {
            return 1;
        }

        // at this point, the signs are the same, so subtraction will not overflow
        if (this.subtract(other).isNegative()) {
            return -1;
        } else {
            return 1;
        }
    };


    /** @return {!goog.math.Long} The negation of this value. */
    goog.math.Long.prototype.negate = function() {
        if (this.equals(goog.math.Long.MIN_VALUE)) {
            return goog.math.Long.MIN_VALUE;
        } else {
            return this.not().add(goog.math.Long.ONE);
        }
    };


    /**
     * Returns the sum of this and the given Long.
     * @param {goog.math.Long} other Long to add to this one.
     * @return {!goog.math.Long} The sum of this and the given Long.
     */
    goog.math.Long.prototype.add = function(other) {
        // Divide each number into 4 chunks of 16 bits, and then sum the chunks.

        var a48 = this.high_ >>> 16;
        var a32 = this.high_ & 0xFFFF;
        var a16 = this.low_ >>> 16;
        var a00 = this.low_ & 0xFFFF;

        var b48 = other.high_ >>> 16;
        var b32 = other.high_ & 0xFFFF;
        var b16 = other.low_ >>> 16;
        var b00 = other.low_ & 0xFFFF;

        var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
        c00 += a00 + b00;
        c16 += c00 >>> 16;
        c00 &= 0xFFFF;
        c16 += a16 + b16;
        c32 += c16 >>> 16;
        c16 &= 0xFFFF;
        c32 += a32 + b32;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c48 += a48 + b48;
        c48 &= 0xFFFF;
        return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
    };


    /**
     * Returns the difference of this and the given Long.
     * @param {goog.math.Long} other Long to subtract from this.
     * @return {!goog.math.Long} The difference of this and the given Long.
     */
    goog.math.Long.prototype.subtract = function(other) {
        return this.add(other.negate());
    };


    /**
     * Returns the product of this and the given long.
     * @param {goog.math.Long} other Long to multiply with this.
     * @return {!goog.math.Long} The product of this and the other.
     */
    goog.math.Long.prototype.multiply = function(other) {
        if (this.isZero()) {
            return goog.math.Long.ZERO;
        } else if (other.isZero()) {
            return goog.math.Long.ZERO;
        }

        if (this.equals(goog.math.Long.MIN_VALUE)) {
            return other.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
        } else if (other.equals(goog.math.Long.MIN_VALUE)) {
            return this.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
        }

        if (this.isNegative()) {
            if (other.isNegative()) {
                return this.negate().multiply(other.negate());
            } else {
                return this.negate().multiply(other).negate();
            }
        } else if (other.isNegative()) {
            return this.multiply(other.negate()).negate();
        }

        // If both longs are small, use float multiplication
        if (this.lessThan(goog.math.Long.TWO_PWR_24_) &&
            other.lessThan(goog.math.Long.TWO_PWR_24_)) {
            return goog.math.Long.fromNumber(this.toNumber() * other.toNumber());
        }

        // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
        // We can skip products that would overflow.

        var a48 = this.high_ >>> 16;
        var a32 = this.high_ & 0xFFFF;
        var a16 = this.low_ >>> 16;
        var a00 = this.low_ & 0xFFFF;

        var b48 = other.high_ >>> 16;
        var b32 = other.high_ & 0xFFFF;
        var b16 = other.low_ >>> 16;
        var b00 = other.low_ & 0xFFFF;

        var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
        c00 += a00 * b00;
        c16 += c00 >>> 16;
        c00 &= 0xFFFF;
        c16 += a16 * b00;
        c32 += c16 >>> 16;
        c16 &= 0xFFFF;
        c16 += a00 * b16;
        c32 += c16 >>> 16;
        c16 &= 0xFFFF;
        c32 += a32 * b00;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c32 += a16 * b16;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c32 += a00 * b32;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
        c48 &= 0xFFFF;
        return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
    };


    /**
     * Returns this Long divided by the given one.
     * @param {goog.math.Long} other Long by which to divide.
     * @return {!goog.math.Long} This Long divided by the given one.
     */
    goog.math.Long.prototype.div = function(other) {
        if (other.isZero()) {
            throw Error('division by zero');
        } else if (this.isZero()) {
            return goog.math.Long.ZERO;
        }

        if (this.equals(goog.math.Long.MIN_VALUE)) {
            if (other.equals(goog.math.Long.ONE) ||
                other.equals(goog.math.Long.NEG_ONE)) {
                return goog.math.Long.MIN_VALUE;  // recall that -MIN_VALUE == MIN_VALUE
            } else if (other.equals(goog.math.Long.MIN_VALUE)) {
                return goog.math.Long.ONE;
            } else {
                // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
                var halfThis = this.shiftRight(1);
                var approx = halfThis.div(other).shiftLeft(1);
                if (approx.equals(goog.math.Long.ZERO)) {
                    return other.isNegative() ? goog.math.Long.ONE : goog.math.Long.NEG_ONE;
                } else {
                    var rem = this.subtract(other.multiply(approx));
                    var result = approx.add(rem.div(other));
                    return result;
                }
            }
        } else if (other.equals(goog.math.Long.MIN_VALUE)) {
            return goog.math.Long.ZERO;
        }

        if (this.isNegative()) {
            if (other.isNegative()) {
                return this.negate().div(other.negate());
            } else {
                return this.negate().div(other).negate();
            }
        } else if (other.isNegative()) {
            return this.div(other.negate()).negate();
        }

        // Repeat the following until the remainder is less than other:  find a
        // floating-point that approximates remainder / other *from below*, add this
        // into the result, and subtract it from the remainder.  It is critical that
        // the approximate value is less than or equal to the real value so that the
        // remainder never becomes negative.
        var res = goog.math.Long.ZERO;
        var rem = this;
        while (rem.greaterThanOrEqual(other)) {
            // Approximate the result of division. This may be a little greater or
            // smaller than the actual value.
            var approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));

            // We will tweak the approximate result by changing it in the 48-th digit or
            // the smallest non-fractional digit, whichever is larger.
            var log2 = Math.ceil(Math.log(approx) / Math.LN2);
            var delta = (log2 <= 48) ? 1 : Math.pow(2, log2 - 48);

            // Decrease the approximation until it is smaller than the remainder.  Note
            // that if it is too large, the product overflows and is negative.
            var approxRes = goog.math.Long.fromNumber(approx);
            var approxRem = approxRes.multiply(other);
            while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
                approx -= delta;
                approxRes = goog.math.Long.fromNumber(approx);
                approxRem = approxRes.multiply(other);
            }

            // We know the answer can't be zero... and actually, zero would cause
            // infinite recursion since we would make no progress.
            if (approxRes.isZero()) {
                approxRes = goog.math.Long.ONE;
            }

            res = res.add(approxRes);
            rem = rem.subtract(approxRem);
        }
        return res;
    };


    /**
     * Returns this Long modulo the given one.
     * @param {goog.math.Long} other Long by which to mod.
     * @return {!goog.math.Long} This Long modulo the given one.
     */
    goog.math.Long.prototype.modulo = function(other) {
        return this.subtract(this.div(other).multiply(other));
    };


    /** @return {!goog.math.Long} The bitwise-NOT of this value. */
    goog.math.Long.prototype.not = function() {
        return goog.math.Long.fromBits(~this.low_, ~this.high_);
    };


    /**
     * Returns the bitwise-AND of this Long and the given one.
     * @param {goog.math.Long} other The Long with which to AND.
     * @return {!goog.math.Long} The bitwise-AND of this and the other.
     */
    goog.math.Long.prototype.and = function(other) {
        return goog.math.Long.fromBits(this.low_ & other.low_,
            this.high_ & other.high_);
    };


    /**
     * Returns the bitwise-OR of this Long and the given one.
     * @param {goog.math.Long} other The Long with which to OR.
     * @return {!goog.math.Long} The bitwise-OR of this and the other.
     */
    goog.math.Long.prototype.or = function(other) {
        return goog.math.Long.fromBits(this.low_ | other.low_,
            this.high_ | other.high_);
    };


    /**
     * Returns the bitwise-XOR of this Long and the given one.
     * @param {goog.math.Long} other The Long with which to XOR.
     * @return {!goog.math.Long} The bitwise-XOR of this and the other.
     */
    goog.math.Long.prototype.xor = function(other) {
        return goog.math.Long.fromBits(this.low_ ^ other.low_,
            this.high_ ^ other.high_);
    };


    /**
     * Returns this Long with bits shifted to the left by the given amount.
     * @param {number} numBits The number of bits by which to shift.
     * @return {!goog.math.Long} This shifted to the left by the given amount.
     */
    goog.math.Long.prototype.shiftLeft = function(numBits) {
        numBits &= 63;
        if (numBits == 0) {
            return this;
        } else {
            var low = this.low_;
            if (numBits < 32) {
                var high = this.high_;
                return goog.math.Long.fromBits(
                    low << numBits,
                    (high << numBits) | (low >>> (32 - numBits)));
            } else {
                return goog.math.Long.fromBits(0, low << (numBits - 32));
            }
        }
    };


    /**
     * Returns this Long with bits shifted to the right by the given amount.
     * @param {number} numBits The number of bits by which to shift.
     * @return {!goog.math.Long} This shifted to the right by the given amount.
     */
    goog.math.Long.prototype.shiftRight = function(numBits) {
        numBits &= 63;
        if (numBits == 0) {
            return this;
        } else {
            var high = this.high_;
            if (numBits < 32) {
                var low = this.low_;
                return goog.math.Long.fromBits(
                    (low >>> numBits) | (high << (32 - numBits)),
                    high >> numBits);
            } else {
                return goog.math.Long.fromBits(
                    high >> (numBits - 32),
                    high >= 0 ? 0 : -1);
            }
        }
    };


    /**
     * Returns this Long with bits shifted to the right by the given amount, with
     * the new top bits matching the current sign bit.
     * @param {number} numBits The number of bits by which to shift.
     * @return {!goog.math.Long} This shifted to the right by the given amount, with
     *     zeros placed into the new leading bits.
     */
    goog.math.Long.prototype.shiftRightUnsigned = function(numBits) {
        numBits &= 63;
        if (numBits == 0) {
            return this;
        } else {
            var high = this.high_;
            if (numBits < 32) {
                var low = this.low_;
                return goog.math.Long.fromBits(
                    (low >>> numBits) | (high << (32 - numBits)),
                    high >>> numBits);
            } else if (numBits == 32) {
                return goog.math.Long.fromBits(high, 0);
            } else {
                return goog.math.Long.fromBits(high >>> (numBits - 32), 0);
            }
        }
    };

    //======= begin jsbn =======

    var navigator = { appName: 'Modern Browser' }; // polyfill a little

    // Copyright (c) 2005  Tom Wu
    // All Rights Reserved.
    // http://www-cs-students.stanford.edu/~tjw/jsbn/

    /*
     * Copyright (c) 2003-2005  Tom Wu
     * All Rights Reserved.
     *
     * Permission is hereby granted, free of charge, to any person obtaining
     * a copy of this software and associated documentation files (the
     * "Software"), to deal in the Software without restriction, including
     * without limitation the rights to use, copy, modify, merge, publish,
     * distribute, sublicense, and/or sell copies of the Software, and to
     * permit persons to whom the Software is furnished to do so, subject to
     * the following conditions:
     *
     * The above copyright notice and this permission notice shall be
     * included in all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS-IS" AND WITHOUT WARRANTY OF ANY KIND, 
     * EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY 
     * WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.  
     *
     * IN NO EVENT SHALL TOM WU BE LIABLE FOR ANY SPECIAL, INCIDENTAL,
     * INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND, OR ANY DAMAGES WHATSOEVER
     * RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER OR NOT ADVISED OF
     * THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF LIABILITY, ARISING OUT
     * OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
     *
     * In addition, the following condition applies:
     *
     * All redistributions must retain an intact copy of this copyright notice
     * and disclaimer.
     */

    // Basic JavaScript BN library - subset useful for RSA encryption.

    // Bits per digit
    var dbits;

    // JavaScript engine analysis
    var canary = 0xdeadbeefcafe;
    var j_lm = ((canary&0xffffff)==0xefcafe);

    // (public) Constructor
    function BigInteger(a,b,c) {
        if(a != null)
            if("number" == typeof a) this.fromNumber(a,b,c);
            else if(b == null && "string" != typeof a) this.fromString(a,256);
            else this.fromString(a,b);
    }

    // return new, unset BigInteger
    function nbi() { return new BigInteger(null); }

    // am: Compute w_j += (x*this_i), propagate carries,
    // c is initial carry, returns final carry.
    // c < 3*dvalue, x < 2*dvalue, this_i < dvalue
    // We need to select the fastest one that works in this environment.

    // am1: use a single mult and divide to get the high bits,
    // max digit bits should be 26 because
    // max internal value = 2*dvalue^2-2*dvalue (< 2^53)
    function am1(i,x,w,j,c,n) {
        while(--n >= 0) {
            var v = x*this[i++]+w[j]+c;
            c = Math.floor(v/0x4000000);
            w[j++] = v&0x3ffffff;
        }
        return c;
    }
    // am2 avoids a big mult-and-extract completely.
    // Max digit bits should be <= 30 because we do bitwise ops
    // on values up to 2*hdvalue^2-hdvalue-1 (< 2^31)
    function am2(i,x,w,j,c,n) {
        var xl = x&0x7fff, xh = x>>15;
        while(--n >= 0) {
            var l = this[i]&0x7fff;
            var h = this[i++]>>15;
            var m = xh*l+h*xl;
            l = xl*l+((m&0x7fff)<<15)+w[j]+(c&0x3fffffff);
            c = (l>>>30)+(m>>>15)+xh*h+(c>>>30);
            w[j++] = l&0x3fffffff;
        }
        return c;
    }
    // Alternately, set max digit bits to 28 since some
    // browsers slow down when dealing with 32-bit numbers.
    function am3(i,x,w,j,c,n) {
        var xl = x&0x3fff, xh = x>>14;
        while(--n >= 0) {
            var l = this[i]&0x3fff;
            var h = this[i++]>>14;
            var m = xh*l+h*xl;
            l = xl*l+((m&0x3fff)<<14)+w[j]+c;
            c = (l>>28)+(m>>14)+xh*h;
            w[j++] = l&0xfffffff;
        }
        return c;
    }
    if(j_lm && (navigator.appName == "Microsoft Internet Explorer")) {
        BigInteger.prototype.am = am2;
        dbits = 30;
    }
    else if(j_lm && (navigator.appName != "Netscape")) {
        BigInteger.prototype.am = am1;
        dbits = 26;
    }
    else { // Mozilla/Netscape seems to prefer am3
        BigInteger.prototype.am = am3;
        dbits = 28;
    }

    BigInteger.prototype.DB = dbits;
    BigInteger.prototype.DM = ((1<<dbits)-1);
    BigInteger.prototype.DV = (1<<dbits);

    var BI_FP = 52;
    BigInteger.prototype.FV = Math.pow(2,BI_FP);
    BigInteger.prototype.F1 = BI_FP-dbits;
    BigInteger.prototype.F2 = 2*dbits-BI_FP;

    // Digit conversions
    var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
    var BI_RC = new Array();
    var rr,vv;
    rr = "0".charCodeAt(0);
    for(vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
    rr = "a".charCodeAt(0);
    for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
    rr = "A".charCodeAt(0);
    for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;

    function int2char(n) { return BI_RM.charAt(n); }
    function intAt(s,i) {
        var c = BI_RC[s.charCodeAt(i)];
        return (c==null)?-1:c;
    }

    // (protected) copy this to r
    function bnpCopyTo(r) {
        for(var i = this.t-1; i >= 0; --i) r[i] = this[i];
        r.t = this.t;
        r.s = this.s;
    }

    // (protected) set from integer value x, -DV <= x < DV
    function bnpFromInt(x) {
        this.t = 1;
        this.s = (x<0)?-1:0;
        if(x > 0) this[0] = x;
        else if(x < -1) this[0] = x+DV;
        else this.t = 0;
    }

    // return bigint initialized to value
    function nbv(i) { var r = nbi(); r.fromInt(i); return r; }

    // (protected) set from string and radix
    function bnpFromString(s,b) {
        var k;
        if(b == 16) k = 4;
        else if(b == 8) k = 3;
        else if(b == 256) k = 8; // byte array
        else if(b == 2) k = 1;
        else if(b == 32) k = 5;
        else if(b == 4) k = 2;
        else { this.fromRadix(s,b); return; }
        this.t = 0;
        this.s = 0;
        var i = s.length, mi = false, sh = 0;
        while(--i >= 0) {
            var x = (k==8)?s[i]&0xff:intAt(s,i);
            if(x < 0) {
                if(s.charAt(i) == "-") mi = true;
                continue;
            }
            mi = false;
            if(sh == 0)
                this[this.t++] = x;
            else if(sh+k > this.DB) {
                this[this.t-1] |= (x&((1<<(this.DB-sh))-1))<<sh;
                this[this.t++] = (x>>(this.DB-sh));
            }
            else
                this[this.t-1] |= x<<sh;
            sh += k;
            if(sh >= this.DB) sh -= this.DB;
        }
        if(k == 8 && (s[0]&0x80) != 0) {
            this.s = -1;
            if(sh > 0) this[this.t-1] |= ((1<<(this.DB-sh))-1)<<sh;
        }
        this.clamp();
        if(mi) BigInteger.ZERO.subTo(this,this);
    }

    // (protected) clamp off excess high words
    function bnpClamp() {
        var c = this.s&this.DM;
        while(this.t > 0 && this[this.t-1] == c) --this.t;
    }

    // (public) return string representation in given radix
    function bnToString(b) {
        if(this.s < 0) return "-"+this.negate().toString(b);
        var k;
        if(b == 16) k = 4;
        else if(b == 8) k = 3;
        else if(b == 2) k = 1;
        else if(b == 32) k = 5;
        else if(b == 4) k = 2;
        else return this.toRadix(b);
        var km = (1<<k)-1, d, m = false, r = "", i = this.t;
        var p = this.DB-(i*this.DB)%k;
        if(i-- > 0) {
            if(p < this.DB && (d = this[i]>>p) > 0) { m = true; r = int2char(d); }
            while(i >= 0) {
                if(p < k) {
                    d = (this[i]&((1<<p)-1))<<(k-p);
                    d |= this[--i]>>(p+=this.DB-k);
                }
                else {
                    d = (this[i]>>(p-=k))&km;
                    if(p <= 0) { p += this.DB; --i; }
                }
                if(d > 0) m = true;
                if(m) r += int2char(d);
            }
        }
        return m?r:"0";
    }

    // (public) -this
    function bnNegate() { var r = nbi(); BigInteger.ZERO.subTo(this,r); return r; }

    // (public) |this|
    function bnAbs() { return (this.s<0)?this.negate():this; }

    // (public) return + if this > a, - if this < a, 0 if equal
    function bnCompareTo(a) {
        var r = this.s-a.s;
        if(r != 0) return r;
        var i = this.t;
        r = i-a.t;
        if(r != 0) return (this.s<0)?-r:r;
        while(--i >= 0) if((r=this[i]-a[i]) != 0) return r;
        return 0;
    }

    // returns bit length of the integer x
    function nbits(x) {
        var r = 1, t;
        if((t=x>>>16) != 0) { x = t; r += 16; }
        if((t=x>>8) != 0) { x = t; r += 8; }
        if((t=x>>4) != 0) { x = t; r += 4; }
        if((t=x>>2) != 0) { x = t; r += 2; }
        if((t=x>>1) != 0) { x = t; r += 1; }
        return r;
    }

    // (public) return the number of bits in "this"
    function bnBitLength() {
        if(this.t <= 0) return 0;
        return this.DB*(this.t-1)+nbits(this[this.t-1]^(this.s&this.DM));
    }

    // (protected) r = this << n*DB
    function bnpDLShiftTo(n,r) {
        var i;
        for(i = this.t-1; i >= 0; --i) r[i+n] = this[i];
        for(i = n-1; i >= 0; --i) r[i] = 0;
        r.t = this.t+n;
        r.s = this.s;
    }

    // (protected) r = this >> n*DB
    function bnpDRShiftTo(n,r) {
        for(var i = n; i < this.t; ++i) r[i-n] = this[i];
        r.t = Math.max(this.t-n,0);
        r.s = this.s;
    }

    // (protected) r = this << n
    function bnpLShiftTo(n,r) {
        var bs = n%this.DB;
        var cbs = this.DB-bs;
        var bm = (1<<cbs)-1;
        var ds = Math.floor(n/this.DB), c = (this.s<<bs)&this.DM, i;
        for(i = this.t-1; i >= 0; --i) {
            r[i+ds+1] = (this[i]>>cbs)|c;
            c = (this[i]&bm)<<bs;
        }
        for(i = ds-1; i >= 0; --i) r[i] = 0;
        r[ds] = c;
        r.t = this.t+ds+1;
        r.s = this.s;
        r.clamp();
    }

    // (protected) r = this >> n
    function bnpRShiftTo(n,r) {
        r.s = this.s;
        var ds = Math.floor(n/this.DB);
        if(ds >= this.t) { r.t = 0; return; }
        var bs = n%this.DB;
        var cbs = this.DB-bs;
        var bm = (1<<bs)-1;
        r[0] = this[ds]>>bs;
        for(var i = ds+1; i < this.t; ++i) {
            r[i-ds-1] |= (this[i]&bm)<<cbs;
            r[i-ds] = this[i]>>bs;
        }
        if(bs > 0) r[this.t-ds-1] |= (this.s&bm)<<cbs;
        r.t = this.t-ds;
        r.clamp();
    }

    // (protected) r = this - a
    function bnpSubTo(a,r) {
        var i = 0, c = 0, m = Math.min(a.t,this.t);
        while(i < m) {
            c += this[i]-a[i];
            r[i++] = c&this.DM;
            c >>= this.DB;
        }
        if(a.t < this.t) {
            c -= a.s;
            while(i < this.t) {
                c += this[i];
                r[i++] = c&this.DM;
                c >>= this.DB;
            }
            c += this.s;
        }
        else {
            c += this.s;
            while(i < a.t) {
                c -= a[i];
                r[i++] = c&this.DM;
                c >>= this.DB;
            }
            c -= a.s;
        }
        r.s = (c<0)?-1:0;
        if(c < -1) r[i++] = this.DV+c;
        else if(c > 0) r[i++] = c;
        r.t = i;
        r.clamp();
    }

    // (protected) r = this * a, r != this,a (HAC 14.12)
    // "this" should be the larger one if appropriate.
    function bnpMultiplyTo(a,r) {
        var x = this.abs(), y = a.abs();
        var i = x.t;
        r.t = i+y.t;
        while(--i >= 0) r[i] = 0;
        for(i = 0; i < y.t; ++i) r[i+x.t] = x.am(0,y[i],r,i,0,x.t);
        r.s = 0;
        r.clamp();
        if(this.s != a.s) BigInteger.ZERO.subTo(r,r);
    }

    // (protected) r = this^2, r != this (HAC 14.16)
    function bnpSquareTo(r) {
        var x = this.abs();
        var i = r.t = 2*x.t;
        while(--i >= 0) r[i] = 0;
        for(i = 0; i < x.t-1; ++i) {
            var c = x.am(i,x[i],r,2*i,0,1);
            if((r[i+x.t]+=x.am(i+1,2*x[i],r,2*i+1,c,x.t-i-1)) >= x.DV) {
                r[i+x.t] -= x.DV;
                r[i+x.t+1] = 1;
            }
        }
        if(r.t > 0) r[r.t-1] += x.am(i,x[i],r,2*i,0,1);
        r.s = 0;
        r.clamp();
    }

    // (protected) divide this by m, quotient and remainder to q, r (HAC 14.20)
    // r != q, this != m.  q or r may be null.
    function bnpDivRemTo(m,q,r) {
        var pm = m.abs();
        if(pm.t <= 0) return;
        var pt = this.abs();
        if(pt.t < pm.t) {
            if(q != null) q.fromInt(0);
            if(r != null) this.copyTo(r);
            return;
        }
        if(r == null) r = nbi();
        var y = nbi(), ts = this.s, ms = m.s;
        var nsh = this.DB-nbits(pm[pm.t-1]);	// normalize modulus
        if(nsh > 0) { pm.lShiftTo(nsh,y); pt.lShiftTo(nsh,r); }
        else { pm.copyTo(y); pt.copyTo(r); }
        var ys = y.t;
        var y0 = y[ys-1];
        if(y0 == 0) return;
        var yt = y0*(1<<this.F1)+((ys>1)?y[ys-2]>>this.F2:0);
        var d1 = this.FV/yt, d2 = (1<<this.F1)/yt, e = 1<<this.F2;
        var i = r.t, j = i-ys, t = (q==null)?nbi():q;
        y.dlShiftTo(j,t);
        if(r.compareTo(t) >= 0) {
            r[r.t++] = 1;
            r.subTo(t,r);
        }
        BigInteger.ONE.dlShiftTo(ys,t);
        t.subTo(y,y);	// "negative" y so we can replace sub with am later
        while(y.t < ys) y[y.t++] = 0;
        while(--j >= 0) {
            // Estimate quotient digit
            var qd = (r[--i]==y0)?this.DM:Math.floor(r[i]*d1+(r[i-1]+e)*d2);
            if((r[i]+=y.am(0,qd,r,j,0,ys)) < qd) {	// Try it out
                y.dlShiftTo(j,t);
                r.subTo(t,r);
                while(r[i] < --qd) r.subTo(t,r);
            }
        }
        if(q != null) {
            r.drShiftTo(ys,q);
            if(ts != ms) BigInteger.ZERO.subTo(q,q);
        }
        r.t = ys;
        r.clamp();
        if(nsh > 0) r.rShiftTo(nsh,r);	// Denormalize remainder
        if(ts < 0) BigInteger.ZERO.subTo(r,r);
    }

    // (public) this mod a
    function bnMod(a) {
        var r = nbi();
        this.abs().divRemTo(a,null,r);
        if(this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r,r);
        return r;
    }

    // Modular reduction using "classic" algorithm
    function Classic(m) { this.m = m; }
    function cConvert(x) {
        if(x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
        else return x;
    }
    function cRevert(x) { return x; }
    function cReduce(x) { x.divRemTo(this.m,null,x); }
    function cMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }
    function cSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

    Classic.prototype.convert = cConvert;
    Classic.prototype.revert = cRevert;
    Classic.prototype.reduce = cReduce;
    Classic.prototype.mulTo = cMulTo;
    Classic.prototype.sqrTo = cSqrTo;

    // (protected) return "-1/this % 2^DB"; useful for Mont. reduction
    // justification:
    //         xy == 1 (mod m)
    //         xy =  1+km
    //   xy(2-xy) = (1+km)(1-km)
    // x[y(2-xy)] = 1-k^2m^2
    // x[y(2-xy)] == 1 (mod m^2)
    // if y is 1/x mod m, then y(2-xy) is 1/x mod m^2
    // should reduce x and y(2-xy) by m^2 at each step to keep size bounded.
    // JS multiply "overflows" differently from C/C++, so care is needed here.
    function bnpInvDigit() {
        if(this.t < 1) return 0;
        var x = this[0];
        if((x&1) == 0) return 0;
        var y = x&3;		// y == 1/x mod 2^2
        y = (y*(2-(x&0xf)*y))&0xf;	// y == 1/x mod 2^4
        y = (y*(2-(x&0xff)*y))&0xff;	// y == 1/x mod 2^8
        y = (y*(2-(((x&0xffff)*y)&0xffff)))&0xffff;	// y == 1/x mod 2^16
        // last step - calculate inverse mod DV directly;
        // assumes 16 < DB <= 32 and assumes ability to handle 48-bit ints
        y = (y*(2-x*y%this.DV))%this.DV;		// y == 1/x mod 2^dbits
        // we really want the negative inverse, and -DV < y < DV
        return (y>0)?this.DV-y:-y;
    }

    // Montgomery reduction
    function Montgomery(m) {
        this.m = m;
        this.mp = m.invDigit();
        this.mpl = this.mp&0x7fff;
        this.mph = this.mp>>15;
        this.um = (1<<(m.DB-15))-1;
        this.mt2 = 2*m.t;
    }

    // xR mod m
    function montConvert(x) {
        var r = nbi();
        x.abs().dlShiftTo(this.m.t,r);
        r.divRemTo(this.m,null,r);
        if(x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r,r);
        return r;
    }

    // x/R mod m
    function montRevert(x) {
        var r = nbi();
        x.copyTo(r);
        this.reduce(r);
        return r;
    }

    // x = x/R mod m (HAC 14.32)
    function montReduce(x) {
        while(x.t <= this.mt2)	// pad x so am has enough room later
            x[x.t++] = 0;
        for(var i = 0; i < this.m.t; ++i) {
            // faster way of calculating u0 = x[i]*mp mod DV
            var j = x[i]&0x7fff;
            var u0 = (j*this.mpl+(((j*this.mph+(x[i]>>15)*this.mpl)&this.um)<<15))&x.DM;
            // use am to combine the multiply-shift-add into one call
            j = i+this.m.t;
            x[j] += this.m.am(0,u0,x,i,0,this.m.t);
            // propagate carry
            while(x[j] >= x.DV) { x[j] -= x.DV; x[++j]++; }
        }
        x.clamp();
        x.drShiftTo(this.m.t,x);
        if(x.compareTo(this.m) >= 0) x.subTo(this.m,x);
    }

    // r = "x^2/R mod m"; x != r
    function montSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

    // r = "xy/R mod m"; x,y != r
    function montMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }

    Montgomery.prototype.convert = montConvert;
    Montgomery.prototype.revert = montRevert;
    Montgomery.prototype.reduce = montReduce;
    Montgomery.prototype.mulTo = montMulTo;
    Montgomery.prototype.sqrTo = montSqrTo;

    // (protected) true iff this is even
    function bnpIsEven() { return ((this.t>0)?(this[0]&1):this.s) == 0; }

    // (protected) this^e, e < 2^32, doing sqr and mul with "r" (HAC 14.79)
    function bnpExp(e,z) {
        if(e > 0xffffffff || e < 1) return BigInteger.ONE;
        var r = nbi(), r2 = nbi(), g = z.convert(this), i = nbits(e)-1;
        g.copyTo(r);
        while(--i >= 0) {
            z.sqrTo(r,r2);
            if((e&(1<<i)) > 0) z.mulTo(r2,g,r);
            else { var t = r; r = r2; r2 = t; }
        }
        return z.revert(r);
    }

    // (public) this^e % m, 0 <= e < 2^32
    function bnModPowInt(e,m) {
        var z;
        if(e < 256 || m.isEven()) z = new Classic(m); else z = new Montgomery(m);
        return this.exp(e,z);
    }

    // protected
    BigInteger.prototype.copyTo = bnpCopyTo;
    BigInteger.prototype.fromInt = bnpFromInt;
    BigInteger.prototype.fromString = bnpFromString;
    BigInteger.prototype.clamp = bnpClamp;
    BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
    BigInteger.prototype.drShiftTo = bnpDRShiftTo;
    BigInteger.prototype.lShiftTo = bnpLShiftTo;
    BigInteger.prototype.rShiftTo = bnpRShiftTo;
    BigInteger.prototype.subTo = bnpSubTo;
    BigInteger.prototype.multiplyTo = bnpMultiplyTo;
    BigInteger.prototype.squareTo = bnpSquareTo;
    BigInteger.prototype.divRemTo = bnpDivRemTo;
    BigInteger.prototype.invDigit = bnpInvDigit;
    BigInteger.prototype.isEven = bnpIsEven;
    BigInteger.prototype.exp = bnpExp;

    // public
    BigInteger.prototype.toString = bnToString;
    BigInteger.prototype.negate = bnNegate;
    BigInteger.prototype.abs = bnAbs;
    BigInteger.prototype.compareTo = bnCompareTo;
    BigInteger.prototype.bitLength = bnBitLength;
    BigInteger.prototype.mod = bnMod;
    BigInteger.prototype.modPowInt = bnModPowInt;

    // "constants"
    BigInteger.ZERO = nbv(0);
    BigInteger.ONE = nbv(1);

    // jsbn2 stuff

    // (protected) convert from radix string
    function bnpFromRadix(s,b) {
        this.fromInt(0);
        if(b == null) b = 10;
        var cs = this.chunkSize(b);
        var d = Math.pow(b,cs), mi = false, j = 0, w = 0;
        for(var i = 0; i < s.length; ++i) {
            var x = intAt(s,i);
            if(x < 0) {
                if(s.charAt(i) == "-" && this.signum() == 0) mi = true;
                continue;
            }
            w = b*w+x;
            if(++j >= cs) {
                this.dMultiply(d);
                this.dAddOffset(w,0);
                j = 0;
                w = 0;
            }
        }
        if(j > 0) {
            this.dMultiply(Math.pow(b,j));
            this.dAddOffset(w,0);
        }
        if(mi) BigInteger.ZERO.subTo(this,this);
    }

    // (protected) return x s.t. r^x < DV
    function bnpChunkSize(r) { return Math.floor(Math.LN2*this.DB/Math.log(r)); }

    // (public) 0 if this == 0, 1 if this > 0
    function bnSigNum() {
        if(this.s < 0) return -1;
        else if(this.t <= 0 || (this.t == 1 && this[0] <= 0)) return 0;
        else return 1;
    }

    // (protected) this *= n, this >= 0, 1 < n < DV
    function bnpDMultiply(n) {
        this[this.t] = this.am(0,n-1,this,0,0,this.t);
        ++this.t;
        this.clamp();
    }

    // (protected) this += n << w words, this >= 0
    function bnpDAddOffset(n,w) {
        if(n == 0) return;
        while(this.t <= w) this[this.t++] = 0;
        this[w] += n;
        while(this[w] >= this.DV) {
            this[w] -= this.DV;
            if(++w >= this.t) this[this.t++] = 0;
            ++this[w];
        }
    }

    // (protected) convert to radix string
    function bnpToRadix(b) {
        if(b == null) b = 10;
        if(this.signum() == 0 || b < 2 || b > 36) return "0";
        var cs = this.chunkSize(b);
        var a = Math.pow(b,cs);
        var d = nbv(a), y = nbi(), z = nbi(), r = "";
        this.divRemTo(d,y,z);
        while(y.signum() > 0) {
            r = (a+z.intValue()).toString(b).substr(1) + r;
            y.divRemTo(d,y,z);
        }
        return z.intValue().toString(b) + r;
    }

    // (public) return value as integer
    function bnIntValue() {
        if(this.s < 0) {
            if(this.t == 1) return this[0]-this.DV;
            else if(this.t == 0) return -1;
        }
        else if(this.t == 1) return this[0];
        else if(this.t == 0) return 0;
        // assumes 16 < DB < 32
        return ((this[1]&((1<<(32-this.DB))-1))<<this.DB)|this[0];
    }

    // (protected) r = this + a
    function bnpAddTo(a,r) {
        var i = 0, c = 0, m = Math.min(a.t,this.t);
        while(i < m) {
            c += this[i]+a[i];
            r[i++] = c&this.DM;
            c >>= this.DB;
        }
        if(a.t < this.t) {
            c += a.s;
            while(i < this.t) {
                c += this[i];
                r[i++] = c&this.DM;
                c >>= this.DB;
            }
            c += this.s;
        }
        else {
            c += this.s;
            while(i < a.t) {
                c += a[i];
                r[i++] = c&this.DM;
                c >>= this.DB;
            }
            c += a.s;
        }
        r.s = (c<0)?-1:0;
        if(c > 0) r[i++] = c;
        else if(c < -1) r[i++] = this.DV+c;
        r.t = i;
        r.clamp();
    }

    BigInteger.prototype.fromRadix = bnpFromRadix;
    BigInteger.prototype.chunkSize = bnpChunkSize;
    BigInteger.prototype.signum = bnSigNum;
    BigInteger.prototype.dMultiply = bnpDMultiply;
    BigInteger.prototype.dAddOffset = bnpDAddOffset;
    BigInteger.prototype.toRadix = bnpToRadix;
    BigInteger.prototype.intValue = bnIntValue;
    BigInteger.prototype.addTo = bnpAddTo;

    //======= end jsbn =======

    // Emscripten wrapper
    var Wrapper = {
        abs: function(l, h) {
            var x = new goog.math.Long(l, h);
            var ret;
            if (x.isNegative()) {
                ret = x.negate();
            } else {
                ret = x;
            }
            HEAP32[tempDoublePtr>>2] = ret.low_;
            HEAP32[tempDoublePtr+4>>2] = ret.high_;
        },
        ensureTemps: function() {
            if (Wrapper.ensuredTemps) return;
            Wrapper.ensuredTemps = true;
            Wrapper.two32 = new BigInteger();
            Wrapper.two32.fromString('4294967296', 10);
            Wrapper.two64 = new BigInteger();
            Wrapper.two64.fromString('18446744073709551616', 10);
            Wrapper.temp1 = new BigInteger();
            Wrapper.temp2 = new BigInteger();
        },
        lh2bignum: function(l, h) {
            var a = new BigInteger();
            a.fromString(h.toString(), 10);
            var b = new BigInteger();
            a.multiplyTo(Wrapper.two32, b);
            var c = new BigInteger();
            c.fromString(l.toString(), 10);
            var d = new BigInteger();
            c.addTo(b, d);
            return d;
        },
        stringify: function(l, h, unsigned) {
            var ret = new goog.math.Long(l, h).toString();
            if (unsigned && ret[0] == '-') {
                // unsign slowly using jsbn bignums
                Wrapper.ensureTemps();
                var bignum = new BigInteger();
                bignum.fromString(ret, 10);
                ret = new BigInteger();
                Wrapper.two64.addTo(bignum, ret);
                ret = ret.toString(10);
            }
            return ret;
        },
        fromString: function(str, base, min, max, unsigned) {
            Wrapper.ensureTemps();
            var bignum = new BigInteger();
            bignum.fromString(str, base);
            var bigmin = new BigInteger();
            bigmin.fromString(min, 10);
            var bigmax = new BigInteger();
            bigmax.fromString(max, 10);
            if (unsigned && bignum.compareTo(BigInteger.ZERO) < 0) {
                var temp = new BigInteger();
                bignum.addTo(Wrapper.two64, temp);
                bignum = temp;
            }
            var error = false;
            if (bignum.compareTo(bigmin) < 0) {
                bignum = bigmin;
                error = true;
            } else if (bignum.compareTo(bigmax) > 0) {
                bignum = bigmax;
                error = true;
            }
            var ret = goog.math.Long.fromString(bignum.toString()); // min-max checks should have clamped this to a range goog.math.Long can handle well
            HEAP32[tempDoublePtr>>2] = ret.low_;
            HEAP32[tempDoublePtr+4>>2] = ret.high_;
            if (error) throw 'range error';
        }
    };
    return Wrapper;
})();

//======= end closure i64 code =======



// === Auto-generated postamble setup entry stuff ===

if (memoryInitializer) {
    if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
        var data = Module['readBinary'](memoryInitializer);
        HEAPU8.set(data, STATIC_BASE);
    } else {
        addRunDependency('memory initializer');
        Browser.asyncLoad(memoryInitializer, function(data) {
            HEAPU8.set(data, STATIC_BASE);
            removeRunDependency('memory initializer');
        }, function(data) {
            throw 'could not load memory initializer ' + memoryInitializer;
        });
    }
}

function ExitStatus(status) {
    this.name = "ExitStatus";
    this.message = "Program terminated with exit(" + status + ")";
    this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
    // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
    if (!Module['calledRun'] && shouldRunNow) run();
    if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {
    assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
    assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

    args = args || [];

    if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
        Module.printErr('preload time: ' + (Date.now() - preloadStartTime) + ' ms');
    }

    ensureInitRuntime();

    var argc = args.length+1;
    function pad() {
        for (var i = 0; i < 4-1; i++) {
            argv.push(0);
        }
    }
    var argv = [allocate(intArrayFromString("/bin/this.program"), 'i8', ALLOC_NORMAL) ];
    pad();
    for (var i = 0; i < argc-1; i = i + 1) {
        argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
        pad();
    }
    argv.push(0);
    argv = allocate(argv, 'i32', ALLOC_NORMAL);

    initialStackTop = STACKTOP;

    try {

        var ret = Module['_main'](argc, argv, 0);


        // if we're not running an evented main loop, it's time to exit
        if (!Module['noExitRuntime']) {
            exit(ret);
        }
    }
    catch(e) {
        if (e instanceof ExitStatus) {
            // exit() throws this once it's done to make sure execution
            // has been stopped completely
            return;
        } else if (e == 'SimulateInfiniteLoop') {
            // running an evented main loop, don't immediately exit
            Module['noExitRuntime'] = true;
            return;
        } else {
            if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
            throw e;
        }
    } finally {
        calledMain = true;
    }
}




function run(args) {
    args = args || Module['arguments'];

    if (preloadStartTime === null) preloadStartTime = Date.now();

    if (runDependencies > 0) {
        Module.printErr('run() called, but dependencies remain, so not running');
        return;
    }

    preRun();

    if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
    if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

    function doRun() {
        if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
        Module['calledRun'] = true;

        ensureInitRuntime();

        preMain();

        if (Module['_main'] && shouldRunNow) {
            Module['callMain'](args);
        }

        postRun();
    }

    if (Module['setStatus']) {
        Module['setStatus']('Running...');
        setTimeout(function() {
            setTimeout(function() {
                Module['setStatus']('');
            }, 1);
            if (!ABORT) doRun();
        }, 1);
    } else {
        doRun();
    }
}
Module['run'] = Module.run = run;

function exit(status) {
    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    // exit the runtime
    exitRuntime();

    // TODO We should handle this differently based on environment.
    // In the browser, the best we can do is throw an exception
    // to halt execution, but in node we could process.exit and
    // I'd imagine SM shell would have something equivalent.
    // This would let us set a proper exit status (which
    // would be great for checking test exit statuses).
    // https://github.com/kripken/emscripten/issues/1371

    // throw an exception to halt the current execution
    throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

function abort(text) {
    if (text) {
        Module.print(text);
        Module.printErr(text);
    }

    ABORT = true;
    EXITSTATUS = 1;

    var extra = '\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.';

    throw 'abort() at ' + stackTrace() + extra;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
    if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
    while (Module['preInit'].length > 0) {
        Module['preInit'].pop()();
    }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
    shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}






// {{MODULE_ADDITIONS}}






