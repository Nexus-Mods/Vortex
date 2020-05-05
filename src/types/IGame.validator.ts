// @ts-nocheck

'use strict';
var equal = require('ajv/lib/compile/equal');
var validate = (function() {
  var refVal = [];
  var refVal1 = {
    "defaultProperties": [],
    "description": "static information about a tool associated with a game.\nThis info is used to discover such tools and to store that\ndata after discovery\nIt is also the base class for the IGame structure, representing\nthe games themselves",
    "properties": {
      "detach": {
        "description": "if set to true the process tool will be launched detached, that is: not part of Vortex's\nprocess hierarchy",
        "type": "boolean"
      },
      "environment": {
        "additionalProperties": {
          "type": "string"
        },
        "defaultProperties": [],
        "description": "variables to add to the environment when starting this exe. These are in addition to\n(and replacing) existing variables that would be passed automatically.",
        "type": "object"
      },
      "exclusive": {
        "description": "if true, running this tool will block any other applications be run from vortex until it's\ndone. Defaults to false",
        "type": "boolean"
      },
      "executable": {
        "defaultProperties": [],
        "description": "return the path of the tool executable relative to the tool base path,\ni.e. binaries/UT3.exe or TESV.exe\nThis is a function so that you can return different things based on\nthe operating system for example but be aware that it will be evaluated at\napplication start and only once, so the return value can not depend on things\nthat change at runtime.\n\nOptional: Game extensions are free to ignore the parameter and they have\n   to work if the parameter is undefined.\n   executable will be called with the parameter set at the time the game is discovered.\n   If there are multiple versions of the game with different executables, it can return\n   the correct executable based on the variant installed.\n   This is a synchronous function so game extensions will probably want to use something\n   like fs.statSync to text for file existance",
        "typeof": "function"
      },
      "id": {
        "description": "internal name of the tool",
        "type": "string"
      },
      "logo": {
        "description": "path to the image that is to be used as the logo for this tool.\nPlease note: The logo should be easily recognizable and distinguishable from\nother tools.\nFor game logos consider this:\n  - it is especially important to consider distinguishability between different\n    games of the same series.\n  - Preferably the logo should *not* contain the game name because Vortex will display\n    the name as text near the logo. This way the name can be localised.\n  - Background should be transparent. The logo will be resized preserving aspect\n    ratio, the canvas has a 3:4 (portrait) ratio.",
        "type": "string"
      },
      "name": {
        "description": "human readable name used in presentation to the user",
        "type": "string"
      },
      "onStart": {
        "description": "what to do with Vortex when starting the tool. Default is to do nothing. 'hide' will minimize\nVortex and 'close' will make Vortex quit as soon as the tool is started.",
        "enum": ["close", "hide"],
        "type": "string"
      },
      "parameters": {
        "description": "list of parameters to pass to the tool",
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "queryPath": {
        "defaultProperties": [],
        "description": "determine installation path of this tool/game\nThis function should return quickly and, if it returns a value,\nit should definitively be the valid tool/game path. Usually this function\nwill query the path from the registry or from steam.\nThis function may return a promise and it should do that if it's doing I/O\n\nThis may be left undefined but then the tool/game can only be discovered\nby searching the disk which is slow and only happens manually.",
        "typeof": "function"
      },
      "relative": {
        "description": "if true, the tool is expected to be installed relative to the game directory. Otherwise\nthe tool will be detected anywhere on the disk.",
        "type": "boolean"
      },
      "requiredFiles": {
        "description": "list of files that have to exist in the directory of this tool.\nThis is used by the discovery to identify the tool/game. Vortex will only accept\na directory as the tool directory if all these files exist.\nPlease make sure the files listed here uniquely identify the tool, something\nlike 'rpg_rt.exe' would not suffice (rpg_rt.exe is the binary name of a game\nengine and appears in many games).\n\nPlease specify as few files as possible, the more files specified here the slower\nthe discovery will be.\n\nEach file can be specified as a relative path (i.e. binaries/UT3.exe), the path\nis then assumed to be relative to the base directory of the application. It's important\nthis is the case so that Vortex can correctly identify the base directory.\n\nYou can actually use a directory name for this as well.\n\nPrefer to NOT use executables because those will differ between operating systems\nso if the tool/game is multi-platform better use a data file.",
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "shell": {
        "description": "if true, the tool will be run inside a shell",
        "type": "boolean"
      },
      "shortName": {
        "description": "short/abbreviated variant of the name, still intended for presentation to the user\nthis is used when available space is limited. Try to keep it below 8 characters\n(there is no fixed limit but layout may break if this is too long)\nIf none is set, falls back to name",
        "type": "string"
      }
    },
    "required": ["executable", "id", "name", "requiredFiles"],
    "type": "object"
  };
  refVal[1] = refVal1;
  return function validate(data, dataPath, parentData, parentDataProperty, rootData) {
    'use strict';
    var vErrors = null;
    var errors = 0;
    if ((data && typeof data === "object" && !Array.isArray(data))) {
      var missing0;
      if (((data.executable === undefined) && (missing0 = '.executable')) || ((data.queryModPath === undefined) && (missing0 = '.queryModPath'))) {
        validate.errors = [{
          keyword: 'required',
          dataPath: (dataPath || '') + "",
          schemaPath: '#/required',
          params: {
            missingProperty: '' + missing0 + ''
          },
          message: 'should have required property \'' + missing0 + '\''
        }];
        return false;
      } else {
        var errs__0 = errors;
        var valid1 = true;
        if (data.contributed === undefined) {
          valid1 = true;
        } else {
          var errs_1 = errors;
          if (typeof data.contributed !== "string") {
            validate.errors = [{
              keyword: 'type',
              dataPath: (dataPath || '') + '.contributed',
              schemaPath: '#/properties/contributed/type',
              params: {
                type: 'string'
              },
              message: 'should be string'
            }];
            return false;
          }
          var valid1 = errors === errs_1;
        }
        if (valid1) {
          if (valid1) {
            if (data.detach === undefined) {
              valid1 = true;
            } else {
              var errs_1 = errors;
              if (typeof data.detach !== "boolean") {
                validate.errors = [{
                  keyword: 'type',
                  dataPath: (dataPath || '') + '.detach',
                  schemaPath: '#/properties/detach/type',
                  params: {
                    type: 'boolean'
                  },
                  message: 'should be boolean'
                }];
                return false;
              }
              var valid1 = errors === errs_1;
            }
            if (valid1) {
              var data1 = data.details;
              if (data1 === undefined) {
                valid1 = true;
              } else {
                var errs_1 = errors;
                if ((data1 && typeof data1 === "object" && !Array.isArray(data1))) {
                  var errs__1 = errors;
                  var valid2 = true;
                } else {
                  validate.errors = [{
                    keyword: 'type',
                    dataPath: (dataPath || '') + '.details',
                    schemaPath: '#/properties/details/type',
                    params: {
                      type: 'object'
                    },
                    message: 'should be object'
                  }];
                  return false;
                }
                var valid1 = errors === errs_1;
              }
              if (valid1) {
                var data1 = data.environment;
                if (data1 === undefined) {
                  valid1 = true;
                } else {
                  var errs_1 = errors;
                  if ((data1 && typeof data1 === "object" && !Array.isArray(data1))) {
                    var errs__1 = errors;
                    var valid2 = true;
                    for (var key1 in data1) {
                      var errs_2 = errors;
                      if (typeof data1[key1] !== "string") {
                        validate.errors = [{
                          keyword: 'type',
                          dataPath: (dataPath || '') + '.environment[\'' + key1 + '\']',
                          schemaPath: '#/properties/environment/additionalProperties/type',
                          params: {
                            type: 'string'
                          },
                          message: 'should be string'
                        }];
                        return false;
                      }
                      var valid2 = errors === errs_2;
                      if (!valid2) break;
                    }
                  } else {
                    validate.errors = [{
                      keyword: 'type',
                      dataPath: (dataPath || '') + '.environment',
                      schemaPath: '#/properties/environment/type',
                      params: {
                        type: 'object'
                      },
                      message: 'should be object'
                    }];
                    return false;
                  }
                  var valid1 = errors === errs_1;
                }
                if (valid1) {
                  if (data.exclusive === undefined) {
                    valid1 = true;
                  } else {
                    var errs_1 = errors;
                    if (typeof data.exclusive !== "boolean") {
                      validate.errors = [{
                        keyword: 'type',
                        dataPath: (dataPath || '') + '.exclusive',
                        schemaPath: '#/properties/exclusive/type',
                        params: {
                          type: 'boolean'
                        },
                        message: 'should be boolean'
                      }];
                      return false;
                    }
                    var valid1 = errors === errs_1;
                  }
                  if (valid1) {
                    if (valid1) {
                      if (data.extensionPath === undefined) {
                        valid1 = true;
                      } else {
                        var errs_1 = errors;
                        if (typeof data.extensionPath !== "string") {
                          validate.errors = [{
                            keyword: 'type',
                            dataPath: (dataPath || '') + '.extensionPath',
                            schemaPath: '#/properties/extensionPath/type',
                            params: {
                              type: 'string'
                            },
                            message: 'should be string'
                          }];
                          return false;
                        }
                        var valid1 = errors === errs_1;
                      }
                      if (valid1) {
                        if (data.final === undefined) {
                          valid1 = true;
                        } else {
                          var errs_1 = errors;
                          if (typeof data.final !== "boolean") {
                            validate.errors = [{
                              keyword: 'type',
                              dataPath: (dataPath || '') + '.final',
                              schemaPath: '#/properties/final/type',
                              params: {
                                type: 'boolean'
                              },
                              message: 'should be boolean'
                            }];
                            return false;
                          }
                          var valid1 = errors === errs_1;
                        }
                        if (valid1) {
                          if (valid1) {
                            if (data.id === undefined) {
                              valid1 = false;
                              validate.errors = [{
                                keyword: 'required',
                                dataPath: (dataPath || '') + "",
                                schemaPath: '#/required',
                                params: {
                                  missingProperty: 'id'
                                },
                                message: 'should have required property \'id\''
                              }];
                              return false;
                            } else {
                              var errs_1 = errors;
                              if (typeof data.id !== "string") {
                                validate.errors = [{
                                  keyword: 'type',
                                  dataPath: (dataPath || '') + '.id',
                                  schemaPath: '#/properties/id/type',
                                  params: {
                                    type: 'string'
                                  },
                                  message: 'should be string'
                                }];
                                return false;
                              }
                              var valid1 = errors === errs_1;
                            }
                            if (valid1) {
                              if (data.logo === undefined) {
                                valid1 = true;
                              } else {
                                var errs_1 = errors;
                                if (typeof data.logo !== "string") {
                                  validate.errors = [{
                                    keyword: 'type',
                                    dataPath: (dataPath || '') + '.logo',
                                    schemaPath: '#/properties/logo/type',
                                    params: {
                                      type: 'string'
                                    },
                                    message: 'should be string'
                                  }];
                                  return false;
                                }
                                var valid1 = errors === errs_1;
                              }
                              if (valid1) {
                                if (valid1) {
                                  if (data.mergeMods === undefined) {
                                    valid1 = false;
                                    validate.errors = [{
                                      keyword: 'required',
                                      dataPath: (dataPath || '') + "",
                                      schemaPath: '#/required',
                                      params: {
                                        missingProperty: 'mergeMods'
                                      },
                                      message: 'should have required property \'mergeMods\''
                                    }];
                                    return false;
                                  } else {
                                    var errs_1 = errors;
                                    var valid1 = errors === errs_1;
                                  }
                                  if (valid1) {
                                    if (data.modTypes === undefined) {
                                      valid1 = true;
                                    } else {
                                      var errs_1 = errors;
                                      if (!Array.isArray(data.modTypes)) {
                                        validate.errors = [{
                                          keyword: 'type',
                                          dataPath: (dataPath || '') + '.modTypes',
                                          schemaPath: '#/properties/modTypes/type',
                                          params: {
                                            type: 'array'
                                          },
                                          message: 'should be array'
                                        }];
                                        return false;
                                      }
                                      var valid1 = errors === errs_1;
                                    }
                                    if (valid1) {
                                      if (data.name === undefined) {
                                        valid1 = false;
                                        validate.errors = [{
                                          keyword: 'required',
                                          dataPath: (dataPath || '') + "",
                                          schemaPath: '#/required',
                                          params: {
                                            missingProperty: 'name'
                                          },
                                          message: 'should have required property \'name\''
                                        }];
                                        return false;
                                      } else {
                                        var errs_1 = errors;
                                        if (typeof data.name !== "string") {
                                          validate.errors = [{
                                            keyword: 'type',
                                            dataPath: (dataPath || '') + '.name',
                                            schemaPath: '#/properties/name/type',
                                            params: {
                                              type: 'string'
                                            },
                                            message: 'should be string'
                                          }];
                                          return false;
                                        }
                                        var valid1 = errors === errs_1;
                                      }
                                      if (valid1) {
                                        var data1 = data.onStart;
                                        if (data1 === undefined) {
                                          valid1 = true;
                                        } else {
                                          var errs_1 = errors;
                                          if (typeof data1 !== "string") {
                                            validate.errors = [{
                                              keyword: 'type',
                                              dataPath: (dataPath || '') + '.onStart',
                                              schemaPath: '#/properties/onStart/type',
                                              params: {
                                                type: 'string'
                                              },
                                              message: 'should be string'
                                            }];
                                            return false;
                                          }
                                          var schema1 = validate.schema.properties.onStart.enum;
                                          var valid1;
                                          valid1 = false;
                                          for (var i1 = 0; i1 < schema1.length; i1++)
                                            if (equal(data1, schema1[i1])) {
                                              valid1 = true;
                                              break;
                                            } if (!valid1) {
                                            validate.errors = [{
                                              keyword: 'enum',
                                              dataPath: (dataPath || '') + '.onStart',
                                              schemaPath: '#/properties/onStart/enum',
                                              params: {
                                                allowedValues: schema1
                                              },
                                              message: 'should be equal to one of the allowed values'
                                            }];
                                            return false;
                                          }
                                          var valid1 = errors === errs_1;
                                        }
                                        if (valid1) {
                                          var data1 = data.parameters;
                                          if (data1 === undefined) {
                                            valid1 = true;
                                          } else {
                                            var errs_1 = errors;
                                            if (Array.isArray(data1)) {
                                              var errs__1 = errors;
                                              var valid1;
                                              for (var i1 = 0; i1 < data1.length; i1++) {
                                                var errs_2 = errors;
                                                if (typeof data1[i1] !== "string") {
                                                  validate.errors = [{
                                                    keyword: 'type',
                                                    dataPath: (dataPath || '') + '.parameters[' + i1 + ']',
                                                    schemaPath: '#/properties/parameters/items/type',
                                                    params: {
                                                      type: 'string'
                                                    },
                                                    message: 'should be string'
                                                  }];
                                                  return false;
                                                }
                                                var valid2 = errors === errs_2;
                                                if (!valid2) break;
                                              }
                                            } else {
                                              validate.errors = [{
                                                keyword: 'type',
                                                dataPath: (dataPath || '') + '.parameters',
                                                schemaPath: '#/properties/parameters/type',
                                                params: {
                                                  type: 'array'
                                                },
                                                message: 'should be array'
                                              }];
                                              return false;
                                            }
                                            var valid1 = errors === errs_1;
                                          }
                                          if (valid1) {
                                            if (valid1) {
                                              if (valid1) {
                                                if (data.relative === undefined) {
                                                  valid1 = true;
                                                } else {
                                                  var errs_1 = errors;
                                                  if (typeof data.relative !== "boolean") {
                                                    validate.errors = [{
                                                      keyword: 'type',
                                                      dataPath: (dataPath || '') + '.relative',
                                                      schemaPath: '#/properties/relative/type',
                                                      params: {
                                                        type: 'boolean'
                                                      },
                                                      message: 'should be boolean'
                                                    }];
                                                    return false;
                                                  }
                                                  var valid1 = errors === errs_1;
                                                }
                                                if (valid1) {
                                                  var data1 = data.requiredFiles;
                                                  if (data1 === undefined) {
                                                    valid1 = false;
                                                    validate.errors = [{
                                                      keyword: 'required',
                                                      dataPath: (dataPath || '') + "",
                                                      schemaPath: '#/required',
                                                      params: {
                                                        missingProperty: 'requiredFiles'
                                                      },
                                                      message: 'should have required property \'requiredFiles\''
                                                    }];
                                                    return false;
                                                  } else {
                                                    var errs_1 = errors;
                                                    if (Array.isArray(data1)) {
                                                      var errs__1 = errors;
                                                      var valid1;
                                                      for (var i1 = 0; i1 < data1.length; i1++) {
                                                        var errs_2 = errors;
                                                        if (typeof data1[i1] !== "string") {
                                                          validate.errors = [{
                                                            keyword: 'type',
                                                            dataPath: (dataPath || '') + '.requiredFiles[' + i1 + ']',
                                                            schemaPath: '#/properties/requiredFiles/items/type',
                                                            params: {
                                                              type: 'string'
                                                            },
                                                            message: 'should be string'
                                                          }];
                                                          return false;
                                                        }
                                                        var valid2 = errors === errs_2;
                                                        if (!valid2) break;
                                                      }
                                                    } else {
                                                      validate.errors = [{
                                                        keyword: 'type',
                                                        dataPath: (dataPath || '') + '.requiredFiles',
                                                        schemaPath: '#/properties/requiredFiles/type',
                                                        params: {
                                                          type: 'array'
                                                        },
                                                        message: 'should be array'
                                                      }];
                                                      return false;
                                                    }
                                                    var valid1 = errors === errs_1;
                                                  }
                                                  if (valid1) {
                                                    if (data.requiresCleanup === undefined) {
                                                      valid1 = true;
                                                    } else {
                                                      var errs_1 = errors;
                                                      if (typeof data.requiresCleanup !== "boolean") {
                                                        validate.errors = [{
                                                          keyword: 'type',
                                                          dataPath: (dataPath || '') + '.requiresCleanup',
                                                          schemaPath: '#/properties/requiresCleanup/type',
                                                          params: {
                                                            type: 'boolean'
                                                          },
                                                          message: 'should be boolean'
                                                        }];
                                                        return false;
                                                      }
                                                      var valid1 = errors === errs_1;
                                                    }
                                                    if (valid1) {
                                                      if (valid1) {
                                                        if (valid1) {
                                                          if (data.shell === undefined) {
                                                            valid1 = true;
                                                          } else {
                                                            var errs_1 = errors;
                                                            if (typeof data.shell !== "boolean") {
                                                              validate.errors = [{
                                                                keyword: 'type',
                                                                dataPath: (dataPath || '') + '.shell',
                                                                schemaPath: '#/properties/shell/type',
                                                                params: {
                                                                  type: 'boolean'
                                                                },
                                                                message: 'should be boolean'
                                                              }];
                                                              return false;
                                                            }
                                                            var valid1 = errors === errs_1;
                                                          }
                                                          if (valid1) {
                                                            if (data.shortName === undefined) {
                                                              valid1 = true;
                                                            } else {
                                                              var errs_1 = errors;
                                                              if (typeof data.shortName !== "string") {
                                                                validate.errors = [{
                                                                  keyword: 'type',
                                                                  dataPath: (dataPath || '') + '.shortName',
                                                                  schemaPath: '#/properties/shortName/type',
                                                                  params: {
                                                                    type: 'string'
                                                                  },
                                                                  message: 'should be string'
                                                                }];
                                                                return false;
                                                              }
                                                              var valid1 = errors === errs_1;
                                                            }
                                                            if (valid1) {
                                                              var data1 = data.supportedTools;
                                                              if (data1 === undefined) {
                                                                valid1 = true;
                                                              } else {
                                                                var errs_1 = errors;
                                                                if (Array.isArray(data1)) {
                                                                  var errs__1 = errors;
                                                                  var valid1;
                                                                  for (var i1 = 0; i1 < data1.length; i1++) {
                                                                    var data2 = data1[i1];
                                                                    var errs_2 = errors;
                                                                    var errs_3 = errors;
                                                                    if ((data2 && typeof data2 === "object" && !Array.isArray(data2))) {
                                                                      var missing3;
                                                                      if (((data2.executable === undefined) && (missing3 = '.executable'))) {
                                                                        validate.errors = [{
                                                                          keyword: 'required',
                                                                          dataPath: (dataPath || '') + '.supportedTools[' + i1 + ']',
                                                                          schemaPath: '#/definitions/ITool/required',
                                                                          params: {
                                                                            missingProperty: '' + missing3 + ''
                                                                          },
                                                                          message: 'should have required property \'' + missing3 + '\''
                                                                        }];
                                                                        return false;
                                                                      } else {
                                                                        var errs__3 = errors;
                                                                        var valid4 = true;
                                                                        if (data2.detach === undefined) {
                                                                          valid4 = true;
                                                                        } else {
                                                                          var errs_4 = errors;
                                                                          if (typeof data2.detach !== "boolean") {
                                                                            validate.errors = [{
                                                                              keyword: 'type',
                                                                              dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].detach',
                                                                              schemaPath: '#/definitions/ITool/properties/detach/type',
                                                                              params: {
                                                                                type: 'boolean'
                                                                              },
                                                                              message: 'should be boolean'
                                                                            }];
                                                                            return false;
                                                                          }
                                                                          var valid4 = errors === errs_4;
                                                                        }
                                                                        if (valid4) {
                                                                          var data3 = data2.environment;
                                                                          if (data3 === undefined) {
                                                                            valid4 = true;
                                                                          } else {
                                                                            var errs_4 = errors;
                                                                            if ((data3 && typeof data3 === "object" && !Array.isArray(data3))) {
                                                                              var errs__4 = errors;
                                                                              var valid5 = true;
                                                                              for (var key4 in data3) {
                                                                                var errs_5 = errors;
                                                                                if (typeof data3[key4] !== "string") {
                                                                                  validate.errors = [{
                                                                                    keyword: 'type',
                                                                                    dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].environment[\'' + key4 + '\']',
                                                                                    schemaPath: '#/definitions/ITool/properties/environment/additionalProperties/type',
                                                                                    params: {
                                                                                      type: 'string'
                                                                                    },
                                                                                    message: 'should be string'
                                                                                  }];
                                                                                  return false;
                                                                                }
                                                                                var valid5 = errors === errs_5;
                                                                                if (!valid5) break;
                                                                              }
                                                                            } else {
                                                                              validate.errors = [{
                                                                                keyword: 'type',
                                                                                dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].environment',
                                                                                schemaPath: '#/definitions/ITool/properties/environment/type',
                                                                                params: {
                                                                                  type: 'object'
                                                                                },
                                                                                message: 'should be object'
                                                                              }];
                                                                              return false;
                                                                            }
                                                                            var valid4 = errors === errs_4;
                                                                          }
                                                                          if (valid4) {
                                                                            if (data2.exclusive === undefined) {
                                                                              valid4 = true;
                                                                            } else {
                                                                              var errs_4 = errors;
                                                                              if (typeof data2.exclusive !== "boolean") {
                                                                                validate.errors = [{
                                                                                  keyword: 'type',
                                                                                  dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].exclusive',
                                                                                  schemaPath: '#/definitions/ITool/properties/exclusive/type',
                                                                                  params: {
                                                                                    type: 'boolean'
                                                                                  },
                                                                                  message: 'should be boolean'
                                                                                }];
                                                                                return false;
                                                                              }
                                                                              var valid4 = errors === errs_4;
                                                                            }
                                                                            if (valid4) {
                                                                              if (valid4) {
                                                                                if (data2.id === undefined) {
                                                                                  valid4 = false;
                                                                                  validate.errors = [{
                                                                                    keyword: 'required',
                                                                                    dataPath: (dataPath || '') + '.supportedTools[' + i1 + ']',
                                                                                    schemaPath: '#/definitions/ITool/required',
                                                                                    params: {
                                                                                      missingProperty: 'id'
                                                                                    },
                                                                                    message: 'should have required property \'id\''
                                                                                  }];
                                                                                  return false;
                                                                                } else {
                                                                                  var errs_4 = errors;
                                                                                  if (typeof data2.id !== "string") {
                                                                                    validate.errors = [{
                                                                                      keyword: 'type',
                                                                                      dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].id',
                                                                                      schemaPath: '#/definitions/ITool/properties/id/type',
                                                                                      params: {
                                                                                        type: 'string'
                                                                                      },
                                                                                      message: 'should be string'
                                                                                    }];
                                                                                    return false;
                                                                                  }
                                                                                  var valid4 = errors === errs_4;
                                                                                }
                                                                                if (valid4) {
                                                                                  if (data2.logo === undefined) {
                                                                                    valid4 = true;
                                                                                  } else {
                                                                                    var errs_4 = errors;
                                                                                    if (typeof data2.logo !== "string") {
                                                                                      validate.errors = [{
                                                                                        keyword: 'type',
                                                                                        dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].logo',
                                                                                        schemaPath: '#/definitions/ITool/properties/logo/type',
                                                                                        params: {
                                                                                          type: 'string'
                                                                                        },
                                                                                        message: 'should be string'
                                                                                      }];
                                                                                      return false;
                                                                                    }
                                                                                    var valid4 = errors === errs_4;
                                                                                  }
                                                                                  if (valid4) {
                                                                                    if (data2.name === undefined) {
                                                                                      valid4 = false;
                                                                                      validate.errors = [{
                                                                                        keyword: 'required',
                                                                                        dataPath: (dataPath || '') + '.supportedTools[' + i1 + ']',
                                                                                        schemaPath: '#/definitions/ITool/required',
                                                                                        params: {
                                                                                          missingProperty: 'name'
                                                                                        },
                                                                                        message: 'should have required property \'name\''
                                                                                      }];
                                                                                      return false;
                                                                                    } else {
                                                                                      var errs_4 = errors;
                                                                                      if (typeof data2.name !== "string") {
                                                                                        validate.errors = [{
                                                                                          keyword: 'type',
                                                                                          dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].name',
                                                                                          schemaPath: '#/definitions/ITool/properties/name/type',
                                                                                          params: {
                                                                                            type: 'string'
                                                                                          },
                                                                                          message: 'should be string'
                                                                                        }];
                                                                                        return false;
                                                                                      }
                                                                                      var valid4 = errors === errs_4;
                                                                                    }
                                                                                    if (valid4) {
                                                                                      var data3 = data2.onStart;
                                                                                      if (data3 === undefined) {
                                                                                        valid4 = true;
                                                                                      } else {
                                                                                        var errs_4 = errors;
                                                                                        if (typeof data3 !== "string") {
                                                                                          validate.errors = [{
                                                                                            keyword: 'type',
                                                                                            dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].onStart',
                                                                                            schemaPath: '#/definitions/ITool/properties/onStart/type',
                                                                                            params: {
                                                                                              type: 'string'
                                                                                            },
                                                                                            message: 'should be string'
                                                                                          }];
                                                                                          return false;
                                                                                        }
                                                                                        var schema4 = refVal1.properties.onStart.enum;
                                                                                        var valid4;
                                                                                        valid4 = false;
                                                                                        for (var i4 = 0; i4 < schema4.length; i4++)
                                                                                          if (equal(data3, schema4[i4])) {
                                                                                            valid4 = true;
                                                                                            break;
                                                                                          } if (!valid4) {
                                                                                          validate.errors = [{
                                                                                            keyword: 'enum',
                                                                                            dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].onStart',
                                                                                            schemaPath: '#/definitions/ITool/properties/onStart/enum',
                                                                                            params: {
                                                                                              allowedValues: schema4
                                                                                            },
                                                                                            message: 'should be equal to one of the allowed values'
                                                                                          }];
                                                                                          return false;
                                                                                        }
                                                                                        var valid4 = errors === errs_4;
                                                                                      }
                                                                                      if (valid4) {
                                                                                        var data3 = data2.parameters;
                                                                                        if (data3 === undefined) {
                                                                                          valid4 = true;
                                                                                        } else {
                                                                                          var errs_4 = errors;
                                                                                          if (Array.isArray(data3)) {
                                                                                            var errs__4 = errors;
                                                                                            var valid4;
                                                                                            for (var i4 = 0; i4 < data3.length; i4++) {
                                                                                              var errs_5 = errors;
                                                                                              if (typeof data3[i4] !== "string") {
                                                                                                validate.errors = [{
                                                                                                  keyword: 'type',
                                                                                                  dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].parameters[' + i4 + ']',
                                                                                                  schemaPath: '#/definitions/ITool/properties/parameters/items/type',
                                                                                                  params: {
                                                                                                    type: 'string'
                                                                                                  },
                                                                                                  message: 'should be string'
                                                                                                }];
                                                                                                return false;
                                                                                              }
                                                                                              var valid5 = errors === errs_5;
                                                                                              if (!valid5) break;
                                                                                            }
                                                                                          } else {
                                                                                            validate.errors = [{
                                                                                              keyword: 'type',
                                                                                              dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].parameters',
                                                                                              schemaPath: '#/definitions/ITool/properties/parameters/type',
                                                                                              params: {
                                                                                                type: 'array'
                                                                                              },
                                                                                              message: 'should be array'
                                                                                            }];
                                                                                            return false;
                                                                                          }
                                                                                          var valid4 = errors === errs_4;
                                                                                        }
                                                                                        if (valid4) {
                                                                                          if (valid4) {
                                                                                            if (data2.relative === undefined) {
                                                                                              valid4 = true;
                                                                                            } else {
                                                                                              var errs_4 = errors;
                                                                                              if (typeof data2.relative !== "boolean") {
                                                                                                validate.errors = [{
                                                                                                  keyword: 'type',
                                                                                                  dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].relative',
                                                                                                  schemaPath: '#/definitions/ITool/properties/relative/type',
                                                                                                  params: {
                                                                                                    type: 'boolean'
                                                                                                  },
                                                                                                  message: 'should be boolean'
                                                                                                }];
                                                                                                return false;
                                                                                              }
                                                                                              var valid4 = errors === errs_4;
                                                                                            }
                                                                                            if (valid4) {
                                                                                              var data3 = data2.requiredFiles;
                                                                                              if (data3 === undefined) {
                                                                                                valid4 = false;
                                                                                                validate.errors = [{
                                                                                                  keyword: 'required',
                                                                                                  dataPath: (dataPath || '') + '.supportedTools[' + i1 + ']',
                                                                                                  schemaPath: '#/definitions/ITool/required',
                                                                                                  params: {
                                                                                                    missingProperty: 'requiredFiles'
                                                                                                  },
                                                                                                  message: 'should have required property \'requiredFiles\''
                                                                                                }];
                                                                                                return false;
                                                                                              } else {
                                                                                                var errs_4 = errors;
                                                                                                if (Array.isArray(data3)) {
                                                                                                  var errs__4 = errors;
                                                                                                  var valid4;
                                                                                                  for (var i4 = 0; i4 < data3.length; i4++) {
                                                                                                    var errs_5 = errors;
                                                                                                    if (typeof data3[i4] !== "string") {
                                                                                                      validate.errors = [{
                                                                                                        keyword: 'type',
                                                                                                        dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].requiredFiles[' + i4 + ']',
                                                                                                        schemaPath: '#/definitions/ITool/properties/requiredFiles/items/type',
                                                                                                        params: {
                                                                                                          type: 'string'
                                                                                                        },
                                                                                                        message: 'should be string'
                                                                                                      }];
                                                                                                      return false;
                                                                                                    }
                                                                                                    var valid5 = errors === errs_5;
                                                                                                    if (!valid5) break;
                                                                                                  }
                                                                                                } else {
                                                                                                  validate.errors = [{
                                                                                                    keyword: 'type',
                                                                                                    dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].requiredFiles',
                                                                                                    schemaPath: '#/definitions/ITool/properties/requiredFiles/type',
                                                                                                    params: {
                                                                                                      type: 'array'
                                                                                                    },
                                                                                                    message: 'should be array'
                                                                                                  }];
                                                                                                  return false;
                                                                                                }
                                                                                                var valid4 = errors === errs_4;
                                                                                              }
                                                                                              if (valid4) {
                                                                                                if (data2.shell === undefined) {
                                                                                                  valid4 = true;
                                                                                                } else {
                                                                                                  var errs_4 = errors;
                                                                                                  if (typeof data2.shell !== "boolean") {
                                                                                                    validate.errors = [{
                                                                                                      keyword: 'type',
                                                                                                      dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].shell',
                                                                                                      schemaPath: '#/definitions/ITool/properties/shell/type',
                                                                                                      params: {
                                                                                                        type: 'boolean'
                                                                                                      },
                                                                                                      message: 'should be boolean'
                                                                                                    }];
                                                                                                    return false;
                                                                                                  }
                                                                                                  var valid4 = errors === errs_4;
                                                                                                }
                                                                                                if (valid4) {
                                                                                                  if (data2.shortName === undefined) {
                                                                                                    valid4 = true;
                                                                                                  } else {
                                                                                                    var errs_4 = errors;
                                                                                                    if (typeof data2.shortName !== "string") {
                                                                                                      validate.errors = [{
                                                                                                        keyword: 'type',
                                                                                                        dataPath: (dataPath || '') + '.supportedTools[' + i1 + '].shortName',
                                                                                                        schemaPath: '#/definitions/ITool/properties/shortName/type',
                                                                                                        params: {
                                                                                                          type: 'string'
                                                                                                        },
                                                                                                        message: 'should be string'
                                                                                                      }];
                                                                                                      return false;
                                                                                                    }
                                                                                                    var valid4 = errors === errs_4;
                                                                                                  }
                                                                                                }
                                                                                              }
                                                                                            }
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                    } else {
                                                                      validate.errors = [{
                                                                        keyword: 'type',
                                                                        dataPath: (dataPath || '') + '.supportedTools[' + i1 + ']',
                                                                        schemaPath: '#/definitions/ITool/type',
                                                                        params: {
                                                                          type: 'object'
                                                                        },
                                                                        message: 'should be object'
                                                                      }];
                                                                      return false;
                                                                    }
                                                                    var valid3 = errors === errs_3;
                                                                    var valid2 = errors === errs_2;
                                                                    if (!valid2) break;
                                                                  }
                                                                } else {
                                                                  validate.errors = [{
                                                                    keyword: 'type',
                                                                    dataPath: (dataPath || '') + '.supportedTools',
                                                                    schemaPath: '#/properties/supportedTools/type',
                                                                    params: {
                                                                      type: 'array'
                                                                    },
                                                                    message: 'should be array'
                                                                  }];
                                                                  return false;
                                                                }
                                                                var valid1 = errors === errs_1;
                                                              }
                                                              if (valid1) {
                                                                if (data.version === undefined) {
                                                                  valid1 = true;
                                                                } else {
                                                                  var errs_1 = errors;
                                                                  if (typeof data.version !== "string") {
                                                                    validate.errors = [{
                                                                      keyword: 'type',
                                                                      dataPath: (dataPath || '') + '.version',
                                                                      schemaPath: '#/properties/version/type',
                                                                      params: {
                                                                        type: 'string'
                                                                      },
                                                                      message: 'should be string'
                                                                    }];
                                                                    return false;
                                                                  }
                                                                  var valid1 = errors === errs_1;
                                                                }
                                                              }
                                                            }
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate.errors = [{
        keyword: 'type',
        dataPath: (dataPath || '') + "",
        schemaPath: '#/type',
        params: {
          type: 'object'
        },
        message: 'should be object'
      }];
      return false;
    }
    validate.errors = vErrors;
    return errors === 0;
  };
})();
validate.schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "defaultProperties": [],
  "definitions": {
    "ITool": {
      "defaultProperties": [],
      "description": "static information about a tool associated with a game.\nThis info is used to discover such tools and to store that\ndata after discovery\nIt is also the base class for the IGame structure, representing\nthe games themselves",
      "properties": {
        "detach": {
          "description": "if set to true the process tool will be launched detached, that is: not part of Vortex's\nprocess hierarchy",
          "type": "boolean"
        },
        "environment": {
          "additionalProperties": {
            "type": "string"
          },
          "defaultProperties": [],
          "description": "variables to add to the environment when starting this exe. These are in addition to\n(and replacing) existing variables that would be passed automatically.",
          "type": "object"
        },
        "exclusive": {
          "description": "if true, running this tool will block any other applications be run from vortex until it's\ndone. Defaults to false",
          "type": "boolean"
        },
        "executable": {
          "defaultProperties": [],
          "description": "return the path of the tool executable relative to the tool base path,\ni.e. binaries/UT3.exe or TESV.exe\nThis is a function so that you can return different things based on\nthe operating system for example but be aware that it will be evaluated at\napplication start and only once, so the return value can not depend on things\nthat change at runtime.\n\nOptional: Game extensions are free to ignore the parameter and they have\n   to work if the parameter is undefined.\n   executable will be called with the parameter set at the time the game is discovered.\n   If there are multiple versions of the game with different executables, it can return\n   the correct executable based on the variant installed.\n   This is a synchronous function so game extensions will probably want to use something\n   like fs.statSync to text for file existance",
          "typeof": "function"
        },
        "id": {
          "description": "internal name of the tool",
          "type": "string"
        },
        "logo": {
          "description": "path to the image that is to be used as the logo for this tool.\nPlease note: The logo should be easily recognizable and distinguishable from\nother tools.\nFor game logos consider this:\n  - it is especially important to consider distinguishability between different\n    games of the same series.\n  - Preferably the logo should *not* contain the game name because Vortex will display\n    the name as text near the logo. This way the name can be localised.\n  - Background should be transparent. The logo will be resized preserving aspect\n    ratio, the canvas has a 3:4 (portrait) ratio.",
          "type": "string"
        },
        "name": {
          "description": "human readable name used in presentation to the user",
          "type": "string"
        },
        "onStart": {
          "description": "what to do with Vortex when starting the tool. Default is to do nothing. 'hide' will minimize\nVortex and 'close' will make Vortex quit as soon as the tool is started.",
          "enum": ["close", "hide"],
          "type": "string"
        },
        "parameters": {
          "description": "list of parameters to pass to the tool",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "queryPath": {
          "defaultProperties": [],
          "description": "determine installation path of this tool/game\nThis function should return quickly and, if it returns a value,\nit should definitively be the valid tool/game path. Usually this function\nwill query the path from the registry or from steam.\nThis function may return a promise and it should do that if it's doing I/O\n\nThis may be left undefined but then the tool/game can only be discovered\nby searching the disk which is slow and only happens manually.",
          "typeof": "function"
        },
        "relative": {
          "description": "if true, the tool is expected to be installed relative to the game directory. Otherwise\nthe tool will be detected anywhere on the disk.",
          "type": "boolean"
        },
        "requiredFiles": {
          "description": "list of files that have to exist in the directory of this tool.\nThis is used by the discovery to identify the tool/game. Vortex will only accept\na directory as the tool directory if all these files exist.\nPlease make sure the files listed here uniquely identify the tool, something\nlike 'rpg_rt.exe' would not suffice (rpg_rt.exe is the binary name of a game\nengine and appears in many games).\n\nPlease specify as few files as possible, the more files specified here the slower\nthe discovery will be.\n\nEach file can be specified as a relative path (i.e. binaries/UT3.exe), the path\nis then assumed to be relative to the base directory of the application. It's important\nthis is the case so that Vortex can correctly identify the base directory.\n\nYou can actually use a directory name for this as well.\n\nPrefer to NOT use executables because those will differ between operating systems\nso if the tool/game is multi-platform better use a data file.",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "shell": {
          "description": "if true, the tool will be run inside a shell",
          "type": "boolean"
        },
        "shortName": {
          "description": "short/abbreviated variant of the name, still intended for presentation to the user\nthis is used when available space is limited. Try to keep it below 8 characters\n(there is no fixed limit but layout may break if this is too long)\nIf none is set, falls back to name",
          "type": "string"
        }
      },
      "required": ["executable", "id", "name", "requiredFiles"],
      "type": "object"
    }
  },
  "description": "interface for game extensions",
  "properties": {
    "contributed": {
      "description": "set to name of the contributor that added support for this game. For officialy supported\ngames this is undefined",
      "type": "string"
    },
    "deploymentGate": {
      "defaultProperties": [],
      "description": "if set this function is always called before automatic deployment and it will be delayed\nuntil the promise resolves.\nThis can be used if the deployment process is very slow and/or involves user interaction\n(e.g. through will-deploy/did-deploy event handlers) to prevent managament becoming impractical\ndue to automated deployment constantly requiring attention.\n\nOnce the promise resolves the mods as enabled at that time will be deployed, so for example\nif the user enabled a mod while this promise is pending, that mod will be deployed.",
      "typeof": "function"
    },
    "detach": {
      "description": "if set to true the process tool will be launched detached, that is: not part of Vortex's\nprocess hierarchy",
      "type": "boolean"
    },
    "details": {
      "additionalProperties": {},
      "defaultProperties": [],
      "description": "additional details about the game that may be used by extensions. Some extensions may work\nbetter/offer more features if certain details are provided but they are all optional.\nExtensions should do their best to work without these details, even if it takes more work\n(during development and potentially at runtime)",
      "type": "object"
    },
    "environment": {
      "additionalProperties": {
        "type": "string"
      },
      "defaultProperties": [],
      "description": "variables to add to the environment when starting this exe. These are in addition to\n(and replacing) existing variables that would be passed automatically.",
      "type": "object"
    },
    "exclusive": {
      "description": "if true, running this tool will block any other applications be run from vortex until it's\ndone. Defaults to false",
      "type": "boolean"
    },
    "executable": {
      "defaultProperties": [],
      "description": "return the path of the tool executable relative to the tool base path,\ni.e. binaries/UT3.exe or TESV.exe\nThis is a function so that you can return different things based on\nthe operating system for example but be aware that it will be evaluated at\napplication start and only once, so the return value can not depend on things\nthat change at runtime.\n\nOptional: Game extensions are free to ignore the parameter and they have\n   to work if the parameter is undefined.\n   executable will be called with the parameter set at the time the game is discovered.\n   If there are multiple versions of the game with different executables, it can return\n   the correct executable based on the variant installed.\n   This is a synchronous function so game extensions will probably want to use something\n   like fs.statSync to text for file existance",
      "typeof": "function"
    },
    "extensionPath": {
      "description": "path to the game extension and assets included with it. This is automatically\nset on loading the extension and and pre-set value is ignored",
      "type": "string"
    },
    "final": {
      "description": "set to true if support for this game has been fully tested",
      "type": "boolean"
    },
    "getModPaths": {
      "defaultProperties": [],
      "description": "returns all directories where mods for this game\nmay be stored as a dictionary of type to (absolute) path.\n\nDo not implement this in your game extension, the function\nis added by vortex itself",
      "typeof": "function"
    },
    "id": {
      "description": "internal name of the tool",
      "type": "string"
    },
    "logo": {
      "description": "path to the image that is to be used as the logo for this tool.\nPlease note: The logo should be easily recognizable and distinguishable from\nother tools.\nFor game logos consider this:\n  - it is especially important to consider distinguishability between different\n    games of the same series.\n  - Preferably the logo should *not* contain the game name because Vortex will display\n    the name as text near the logo. This way the name can be localised.\n  - Background should be transparent. The logo will be resized preserving aspect\n    ratio, the canvas has a 3:4 (portrait) ratio.",
      "type": "string"
    },
    "mergeArchive": {
      "defaultProperties": [],
      "description": "determines if a file is to be merged with others with the same path, instead of the\nhighest-priority one being used. This only work if support for repackaging the file type\nis available",
      "typeof": "function"
    },
    "mergeMods": {
      "anyOf": [{
        "defaultProperties": [],
        "typeof": "function"
      }, {
        "type": "boolean"
      }],
      "description": "whether to merge mods in the destination directory or put each mod into a separate\ndir.\nExample: say queryModPath returns 'c:/awesomegame/mods' and you install a mod named\n          'crazymod' that contains one file named 'crazytexture.dds'. If mergeMods is\n          true then the file will be placed as c:/awesomegame/mods/crazytexture.dds.\n          If mergeMods is false then it will be c:/awesomegame/mods/crazymod/crazytexture.dds.\n\nNote: For many games the mods are already packaged in such a way that the mod has an\n       additional subdirectory. In games where this is the standard, mergeMods should be true,\n       otherwise Vortex would be introducing one more directory level.\nNote: This should be considered together with \"stop folder\" handling: If the installer has\n       stop folders set up for a game it will attempt to eliminate \"unnecessary\" sub\n       directories from the mod package.\nTODO The name \"mergeMods\" is horrible since we also talk about \"merging\" in the context of\n      combining individual files (archives) during mod deployment which is independent of this"
    },
    "modTypes": {
      "description": "returns the mod type extensions applicable to this game (all\nmod types except the default\n\nDo not implement this in your game extension, this is added\nby vortex",
      "type": "array"
    },
    "name": {
      "description": "human readable name used in presentation to the user",
      "type": "string"
    },
    "onStart": {
      "description": "what to do with Vortex when starting the tool. Default is to do nothing. 'hide' will minimize\nVortex and 'close' will make Vortex quit as soon as the tool is started.",
      "enum": ["close", "hide"],
      "type": "string"
    },
    "parameters": {
      "description": "list of parameters to pass to the tool",
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "queryModPath": {
      "defaultProperties": [],
      "description": "determine the default directory where mods for this game\nshould be stored.\n\nIf this returns a relative path then the path is treated as relative\nto the game installation directory. Simply return a dot ( () => '.' )\nif mods are installed directly into the game directory",
      "typeof": "function"
    },
    "queryPath": {
      "defaultProperties": [],
      "description": "determine installation path of this tool/game\nThis function should return quickly and, if it returns a value,\nit should definitively be the valid tool/game path. Usually this function\nwill query the path from the registry or from steam.\nThis function may return a promise and it should do that if it's doing I/O\n\nThis may be left undefined but then the tool/game can only be discovered\nby searching the disk which is slow and only happens manually.",
      "typeof": "function"
    },
    "relative": {
      "description": "if true, the tool is expected to be installed relative to the game directory. Otherwise\nthe tool will be detected anywhere on the disk.",
      "type": "boolean"
    },
    "requiredFiles": {
      "description": "list of files that have to exist in the directory of this tool.\nThis is used by the discovery to identify the tool/game. Vortex will only accept\na directory as the tool directory if all these files exist.\nPlease make sure the files listed here uniquely identify the tool, something\nlike 'rpg_rt.exe' would not suffice (rpg_rt.exe is the binary name of a game\nengine and appears in many games).\n\nPlease specify as few files as possible, the more files specified here the slower\nthe discovery will be.\n\nEach file can be specified as a relative path (i.e. binaries/UT3.exe), the path\nis then assumed to be relative to the base directory of the application. It's important\nthis is the case so that Vortex can correctly identify the base directory.\n\nYou can actually use a directory name for this as well.\n\nPrefer to NOT use executables because those will differ between operating systems\nso if the tool/game is multi-platform better use a data file.",
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "requiresCleanup": {
      "description": "should be set to true only if the game in question needs its mod folders\n  cleaned up on each deploy event.",
      "type": "boolean"
    },
    "requiresLauncher": {
      "defaultProperties": [],
      "description": "Determine whether the game needs to be executed via a launcher, like Steam or EpicGamesLauncher\n\nIf this returns a value, Vortex will use appropriate code for that launcher",
      "typeof": "function"
    },
    "setup": {
      "defaultProperties": [],
      "description": "Optional setup function. If this game requires some form of setup before it can be modded\n(like creating a directory, changing a registry key, ...) do it here. It will be called\nevery time before the game mode is activated.",
      "typeof": "function"
    },
    "shell": {
      "description": "if true, the tool will be run inside a shell",
      "type": "boolean"
    },
    "shortName": {
      "description": "short/abbreviated variant of the name, still intended for presentation to the user\nthis is used when available space is limited. Try to keep it below 8 characters\n(there is no fixed limit but layout may break if this is too long)\nIf none is set, falls back to name",
      "type": "string"
    },
    "supportedTools": {
      "description": "list of tools that support this game",
      "items": {
        "$ref": "#/definitions/ITool"
      },
      "type": "array"
    },
    "version": {
      "description": "contains the version of the game extension",
      "type": "string"
    }
  },
  "required": ["executable", "id", "mergeMods", "name", "queryModPath", "requiredFiles"],
  "type": "object"
};
validate.errors = null;
module.exports = validate;
