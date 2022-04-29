// @ts-nocheck
'use strict';

export default function isVersionProvider(data): any[] {
    const { supported, getGameVersion } = data;
    // ts-v-gen can't handle types very well - this is a temporary, extremely ugly
    //  hack to at least try to ensure that the test and func logic has the expected
    //  function signature while I figure out how to handle functors in ts-v-gen.
    // const rgx = new RegExp('(function.*\(.*,.*\).*{$)|(.*resolve\(|.*reject)', 'gm');
    // const what = supported.supported.toString();
    // if (supported.supported.toString()) {
    //     return ['Incorrect return type signature for provider test'];
    // }
    const res = validate10(data);
    return (res === false) ? validate10.prototype.constructor.errors : null;
}

const schema11 = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "anyOf": [{
        "$ref": "#/definitions/IGameVersionProvider"
    }],
    "definitions": {
        "IGameVersionProvider": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string"
                },
                "priority": {
                    "type": "number"
                },
                "supported": {
                    "type": "object",
                    "properties": {
                        "isFunction": {
                            "type": "boolean",
                            "const": true
                        }
                    }
                },
                "getGameVersion": {
                    "type": "object",
                    "properties": {
                        "isFunction": {
                            "type": "boolean",
                            "const": true
                        }
                    }
                },
                "options": {
                    "$ref": "#/definitions/IGameVersionProviderOptions"
                }
            },
            "required": ["id", "priority", "supported", "getGameVersion"],
            "additionalProperties": false
        },
        "IGameVersionProviderOptions": {
            "type": "object",
            "additionalProperties": false
        }
    }
};
const schema12 = {
    "type": "object",
    "properties": {
        "id": {
            "type": "string"
        },
        "priority": {
            "type": "number"
        },
        "supported": {
            "type": "object",
            "properties": {
                "isFunction": {
                    "type": "boolean",
                    "const": true
                }
            }
        },
        "getGameVersion": {
            "type": "object",
            "properties": {
                "isFunction": {
                    "type": "boolean",
                    "const": true
                }
            }
        },
        "options": {
            "$ref": "#/definitions/IGameVersionProviderOptions"
        }
    },
    "required": ["id", "priority", "supported", "getGameVersion"],
    "additionalProperties": false
};
const schema13 = {
    "type": "object",
    "additionalProperties": false
};

function isAsyncFunc(data) {
  const what = Object.getPrototypeOf(data);
  return Object.getPrototypeOf(data).constructor.name === 'AsyncFunction';
}

function isFunc(data) {
  const valid = ['Object', 'Function'];
  const prot = Object.getPrototypeOf(data);
  return (valid.indexOf(prot.constructor.name) !== -1);
}

function validate11(data, {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data
} = {}) {
    let vErrors = null;
    let errors = 0;
    if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.id === undefined) {
            const err0 = {
                instancePath,
                schemaPath: "#/required",
                keyword: "required",
                params: {
                    missingProperty: "id"
                },
                message: "must have required property '" + "id" + "'",
                schema: schema12.required,
                parentSchema: schema12,
                data
            };
            if (vErrors === null) {
                vErrors = [err0];
            } else {
                vErrors.push(err0);
            }
            errors++;
        }
        if (data.priority === undefined) {
            const err1 = {
                instancePath,
                schemaPath: "#/required",
                keyword: "required",
                params: {
                    missingProperty: "priority"
                },
                message: "must have required property '" + "priority" + "'",
                schema: schema12.required,
                parentSchema: schema12,
                data
            };
            if (vErrors === null) {
                vErrors = [err1];
            } else {
                vErrors.push(err1);
            }
            errors++;
        }
        if (data.supported === undefined) {
            const err2 = {
                instancePath,
                schemaPath: "#/required",
                keyword: "required",
                params: {
                    missingProperty: "supported"
                },
                message: "must have required property '" + "supported" + "'",
                schema: schema12.required,
                parentSchema: schema12,
                data
            };
            if (vErrors === null) {
                vErrors = [err2];
            } else {
                vErrors.push(err2);
            }
            errors++;
        }
        if (data.getGameVersion === undefined) {
            const err3 = {
                instancePath,
                schemaPath: "#/required",
                keyword: "required",
                params: {
                    missingProperty: "getGameVersion"
                },
                message: "must have required property '" + "getGameVersion" + "'",
                schema: schema12.required,
                parentSchema: schema12,
                data
            };
            if (vErrors === null) {
                vErrors = [err3];
            } else {
                vErrors.push(err3);
            }
            errors++;
        }
        for (const key0 in data) {
            if (!(((((key0 === "id") || (key0 === "priority")) || (key0 === "supported")) || (key0 === "getGameVersion")) || (key0 === "options"))) {
                const err4 = {
                    instancePath,
                    schemaPath: "#/additionalProperties",
                    keyword: "additionalProperties",
                    params: {
                        additionalProperty: key0
                    },
                    message: "must NOT have additional properties",
                    schema: false,
                    parentSchema: schema12,
                    data
                };
                if (vErrors === null) {
                    vErrors = [err4];
                } else {
                    vErrors.push(err4);
                }
                errors++;
            }
        }
        if (data.id !== undefined) {
            let data0 = data.id;
            if (typeof data0 !== "string") {
                const err5 = {
                    instancePath: instancePath + "/id",
                    schemaPath: "#/properties/id/type",
                    keyword: "type",
                    params: {
                        type: "string"
                    },
                    message: "must be string",
                    schema: schema12.properties.id.type,
                    parentSchema: schema12.properties.id,
                    data: data0
                };
                if (vErrors === null) {
                    vErrors = [err5];
                } else {
                    vErrors.push(err5);
                }
                errors++;
            }
        }
        if (data.priority !== undefined) {
            let data1 = data.priority;
            if (!((typeof data1 == "number") && (isFinite(data1)))) {
                const err6 = {
                    instancePath: instancePath + "/priority",
                    schemaPath: "#/properties/priority/type",
                    keyword: "type",
                    params: {
                        type: "number"
                    },
                    message: "must be number",
                    schema: schema12.properties.priority.type,
                    parentSchema: schema12.properties.priority,
                    data: data1
                };
                if (vErrors === null) {
                    vErrors = [err6];
                } else {
                    vErrors.push(err6);
                }
                errors++;
            }
        }
        if (data.supported !== undefined) {
            let data2 = data.supported;
            if (data2 && isFunc(data2) && !Array.isArray(data2)) {
                if (data2.isFunction !== undefined) {
                    let data3 = data2.isFunction;
                    if (typeof data3 !== "boolean") {
                        const err7 = {
                            instancePath: instancePath + "/supported/isFunction",
                            schemaPath: "#/properties/supported/properties/isFunction/type",
                            keyword: "type",
                            params: {
                                type: "boolean"
                            },
                            message: "must be boolean",
                            schema: schema12.properties.supported.properties.isFunction.type,
                            parentSchema: schema12.properties.supported.properties.isFunction,
                            data: data3
                        };
                        if (vErrors === null) {
                            vErrors = [err7];
                        } else {
                            vErrors.push(err7);
                        }
                        errors++;
                    }
                    if (true !== data3) {
                        const err8 = {
                            instancePath: instancePath + "/supported/isFunction",
                            schemaPath: "#/properties/supported/properties/isFunction/const",
                            keyword: "const",
                            params: {
                                allowedValue: true
                            },
                            message: "must be equal to constant",
                            schema: true,
                            parentSchema: schema12.properties.supported.properties.isFunction,
                            data: data3
                        };
                        if (vErrors === null) {
                            vErrors = [err8];
                        } else {
                            vErrors.push(err8);
                        }
                        errors++;
                    }
                }
            } else {
              if (!isAsyncFunc(data2)) {
                const err9 = {
                  instancePath: instancePath + "/supported",
                  schemaPath: "#/properties/supported/type",
                  keyword: "type",
                  params: {
                      type: "object"
                  },
                  message: "must be object",
                  schema: schema12.properties.supported.type,
                  parentSchema: schema12.properties.supported,
                  data: data2
                };
                if (vErrors === null) {
                    vErrors = [err9];
                } else {
                    vErrors.push(err9);
                }
                errors++;
              }
            }
        }
        if (data.getGameVersion !== undefined) {
            let data4 = data.getGameVersion;
            if (data4 && isFunc(data4) && !Array.isArray(data4)) {
                if (data4.isFunction !== undefined) {
                    let data5 = data4.isFunction;
                    if (typeof data5 !== "boolean") {
                        const err10 = {
                            instancePath: instancePath + "/getGameVersion/isFunction",
                            schemaPath: "#/properties/getGameVersion/properties/isFunction/type",
                            keyword: "type",
                            params: {
                                type: "boolean"
                            },
                            message: "must be boolean",
                            schema: schema12.properties.getGameVersion.properties.isFunction.type,
                            parentSchema: schema12.properties.getGameVersion.properties.isFunction,
                            data: data5
                        };
                        if (vErrors === null) {
                            vErrors = [err10];
                        } else {
                            vErrors.push(err10);
                        }
                        errors++;
                    }
                    if (true !== data5) {
                        const err11 = {
                            instancePath: instancePath + "/getGameVersion/isFunction",
                            schemaPath: "#/properties/getGameVersion/properties/isFunction/const",
                            keyword: "const",
                            params: {
                                allowedValue: true
                            },
                            message: "must be equal to constant",
                            schema: true,
                            parentSchema: schema12.properties.getGameVersion.properties.isFunction,
                            data: data5
                        };
                        if (vErrors === null) {
                            vErrors = [err11];
                        } else {
                            vErrors.push(err11);
                        }
                        errors++;
                    }
                }
            } else {
              if (!isAsyncFunc(data4)) {
                const err12 = {
                  instancePath: instancePath + "/getGameVersion",
                  schemaPath: "#/properties/getGameVersion/type",
                  keyword: "type",
                  params: {
                      type: "object"
                  },
                  message: "must be object",
                  schema: schema12.properties.getGameVersion.type,
                  parentSchema: schema12.properties.getGameVersion,
                  data: data4
                };
                if (vErrors === null) {
                    vErrors = [err12];
                } else {
                    vErrors.push(err12);
                }
                errors++;
                }
            }
        }
        if (data.options !== undefined) {
            let data6 = data.options;
            if (data6 && typeof data6 == "object" && !Array.isArray(data6)) {
                for (const key1 in data6) {
                    const err13 = {
                        instancePath: instancePath + "/options",
                        schemaPath: "#/definitions/IGameVersionProviderOptions/additionalProperties",
                        keyword: "additionalProperties",
                        params: {
                            additionalProperty: key1
                        },
                        message: "must NOT have additional properties",
                        schema: false,
                        parentSchema: schema13,
                        data: data6
                    };
                    if (vErrors === null) {
                        vErrors = [err13];
                    } else {
                        vErrors.push(err13);
                    }
                    errors++;
                }
            } else {
                const err14 = {
                    instancePath: instancePath + "/options",
                    schemaPath: "#/definitions/IGameVersionProviderOptions/type",
                    keyword: "type",
                    params: {
                        type: "object"
                    },
                    message: "must be object",
                    schema: schema13.type,
                    parentSchema: schema13,
                    data: data6
                };
                if (vErrors === null) {
                    vErrors = [err14];
                } else {
                    vErrors.push(err14);
                }
                errors++;
            }
        }
    } else {
        const err15 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "object"
            },
            message: "must be object",
            schema: schema12.type,
            parentSchema: schema12,
            data
        };
        if (vErrors === null) {
            vErrors = [err15];
        } else {
            vErrors.push(err15);
        }
        errors++;
    }
    validate11.errors = vErrors;
    return errors === 0;
}

function validate10(data, {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data
} = {}) {
    let vErrors = null;
    let errors = 0;
    const _errs0 = errors;
    let valid0 = false;
    const _errs1 = errors;
    if (!(validate11(data, {
            instancePath,
            parentData,
            parentDataProperty,
            rootData
        }))) {
        vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
        errors = vErrors.length;
    }
    var _valid0 = _errs1 === errors;
    valid0 = valid0 || _valid0;
    if (!valid0) {
        const err0 = {
            instancePath,
            schemaPath: "#/anyOf",
            keyword: "anyOf",
            params: {},
            message: "must match a schema in anyOf",
            schema: schema11.anyOf,
            parentSchema: schema11,
            data
        };
        if (vErrors === null) {
            vErrors = [err0];
        } else {
            vErrors.push(err0);
        }
        errors++;
    } else {
        errors = _errs0;
        if (vErrors !== null) {
            if (_errs0) {
                vErrors.length = _errs0;
            } else {
                vErrors = null;
            }
        }
    }
    validate10.errors = vErrors;
    return errors === 0;
}
