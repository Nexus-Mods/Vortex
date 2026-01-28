"use strict";
module.exports = validate10;
module.exports.default = validate10;
const schema11 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  anyOf: [{ $ref: "#/definitions/ICollection" }],
  definitions: {
    ICollection: {
      type: "object",
      properties: {
        plugins: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              enabled: { type: "boolean" },
            },
            required: ["name"],
          },
        },
        pluginRules: {
          type: "object",
          properties: {
            plugins: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  group: { type: "string" },
                  after: { type: "array", items: { type: "string" } },
                },
                required: ["name"],
              },
            },
            groups: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  group: { type: "string" },
                  after: { type: "array", items: { type: "string" } },
                },
                required: ["name"],
              },
            },
          },
          required: ["plugins"],
        },
        info: { $ref: "#/definitions/ICollectionInfo" },
        mods: {
          type: "array",
          items: { $ref: "#/definitions/ICollectionMod" },
        },
        modRules: {
          type: "array",
          items: { $ref: "#/definitions/ICollectionModRule" },
        },
      },
      required: ["info", "mods", "modRules"],
    },
    ICollectionInfo: {
      type: "object",
      properties: {
        author: { type: "string" },
        authorUrl: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        domainName: { type: "string" },
        gameVersions: { type: "array", items: { type: "string" } },
      },
      required: ["author", "authorUrl", "name", "description", "domainName"],
    },
    ICollectionMod: {
      type: "object",
      properties: {
        name: { type: "string" },
        version: { type: "string" },
        optional: { type: "boolean" },
        domainName: { type: "string" },
        source: { $ref: "#/definitions/ICollectionSourceInfo" },
        hashes: {},
        choices: {},
        patches: { type: "object", additionalProperties: { type: "string" } },
        instructions: { type: "string" },
        author: { type: "string" },
        details: { $ref: "#/definitions/ICollectionModDetails" },
        phase: { type: "number" },
        fileOverrides: { type: "array", items: { type: "string" } },
      },
      required: ["name", "version", "optional", "domainName", "source"],
    },
    ICollectionSourceInfo: {
      type: "object",
      properties: {
        type: { $ref: "#/definitions/SourceType" },
        url: { type: "string" },
        instructions: { type: "string" },
        modId: { type: "number" },
        fileId: { type: "number" },
        updatePolicy: { $ref: "#/definitions/UpdatePolicy" },
        adultContent: { type: "boolean" },
        md5: { type: "string" },
        fileSize: { type: "number" },
        logicalFilename: { type: "string" },
        fileExpression: { type: "string" },
        tag: { type: "string" },
      },
      required: ["type"],
    },
    SourceType: {
      type: "string",
      enum: ["browse", "manual", "direct", "nexus", "bundle"],
    },
    UpdatePolicy: { type: "string", enum: ["exact", "latest", "prefer"] },
    ICollectionModDetails: {
      type: "object",
      properties: { type: { type: "string" }, category: { type: "string" } },
    },
    ICollectionModRule: {
      type: "object",
      properties: {
        source: { $ref: "#/definitions/IModReference" },
        type: { $ref: "#/definitions/RuleType" },
        reference: { $ref: "#/definitions/IModReference" },
      },
      required: ["source", "type", "reference"],
    },
    IModReference: {
      type: "object",
      properties: {
        fileMD5: { type: "string" },
        fileSize: { type: "number" },
        gameId: { type: "string" },
        versionMatch: { type: "string" },
        logicalFileName: { type: "string" },
        fileExpression: { type: "string" },
        id: { type: "string" },
        idHint: { type: "string" },
        md5Hint: { type: "string" },
        tag: { type: "string" },
        archiveId: { type: "string" },
        repo: {
          type: "object",
          properties: {
            gameId: { type: "string" },
            modId: { type: "string" },
            fileId: { type: "string" },
            repository: { type: "string" },
            campaign: { type: "string" },
          },
          required: ["fileId", "repository"],
        },
        description: { type: "string" },
        instructions: { type: "string" },
      },
    },
    RuleType: {
      type: "string",
      enum: [
        "before",
        "after",
        "requires",
        "conflicts",
        "recommends",
        "provides",
      ],
    },
  },
  exported: ["ICollection"],
};
const schema12 = {
  type: "object",
  properties: {
    plugins: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, enabled: { type: "boolean" } },
        required: ["name"],
      },
    },
    pluginRules: {
      type: "object",
      properties: {
        plugins: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              group: { type: "string" },
              after: { type: "array", items: { type: "string" } },
            },
            required: ["name"],
          },
        },
        groups: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              group: { type: "string" },
              after: { type: "array", items: { type: "string" } },
            },
            required: ["name"],
          },
        },
      },
      required: ["plugins"],
    },
    info: { $ref: "#/definitions/ICollectionInfo" },
    mods: { type: "array", items: { $ref: "#/definitions/ICollectionMod" } },
    modRules: {
      type: "array",
      items: { $ref: "#/definitions/ICollectionModRule" },
    },
  },
  required: ["info", "mods", "modRules"],
};
const schema13 = {
  type: "object",
  properties: {
    author: { type: "string" },
    authorUrl: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    domainName: { type: "string" },
    gameVersions: { type: "array", items: { type: "string" } },
  },
  required: ["author", "authorUrl", "name", "description", "domainName"],
};
const schema14 = {
  type: "object",
  properties: {
    name: { type: "string" },
    version: { type: "string" },
    optional: { type: "boolean" },
    domainName: { type: "string" },
    source: { $ref: "#/definitions/ICollectionSourceInfo" },
    hashes: {},
    choices: {},
    patches: { type: "object", additionalProperties: { type: "string" } },
    instructions: { type: "string" },
    author: { type: "string" },
    details: { $ref: "#/definitions/ICollectionModDetails" },
    phase: { type: "number" },
    fileOverrides: { type: "array", items: { type: "string" } },
  },
  required: ["name", "version", "optional", "domainName", "source"],
};
const schema18 = {
  type: "object",
  properties: { type: { type: "string" }, category: { type: "string" } },
};
const schema15 = {
  type: "object",
  properties: {
    type: { $ref: "#/definitions/SourceType" },
    url: { type: "string" },
    instructions: { type: "string" },
    modId: { type: "number" },
    fileId: { type: "number" },
    updatePolicy: { $ref: "#/definitions/UpdatePolicy" },
    adultContent: { type: "boolean" },
    md5: { type: "string" },
    fileSize: { type: "number" },
    logicalFilename: { type: "string" },
    fileExpression: { type: "string" },
    tag: { type: "string" },
  },
  required: ["type"],
};
const schema16 = {
  type: "string",
  enum: ["browse", "manual", "direct", "nexus", "bundle"],
};
const schema17 = { type: "string", enum: ["exact", "latest", "prefer"] };
const func0 = require("./dummy").default;
function validate13(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.type === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "type" },
        message: "must have required property '" + "type" + "'",
        schema: schema15.required,
        parentSchema: schema15,
        data,
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type !== undefined) {
      let data0 = data.type;
      if (typeof data0 !== "string") {
        const err1 = {
          instancePath: instancePath + "/type",
          schemaPath: "#/definitions/SourceType/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema16.type,
          parentSchema: schema16,
          data: data0,
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
      if (
        !(
          data0 === "browse" ||
          data0 === "manual" ||
          data0 === "direct" ||
          data0 === "nexus" ||
          data0 === "bundle"
        )
      ) {
        const err2 = {
          instancePath: instancePath + "/type",
          schemaPath: "#/definitions/SourceType/enum",
          keyword: "enum",
          params: { allowedValues: schema16.enum },
          message: "must be equal to one of the allowed values",
          schema: schema16.enum,
          parentSchema: schema16,
          data: data0,
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.url !== undefined) {
      let data1 = data.url;
      if (typeof data1 !== "string") {
        const err3 = {
          instancePath: instancePath + "/url",
          schemaPath: "#/properties/url/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema15.properties.url.type,
          parentSchema: schema15.properties.url,
          data: data1,
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.instructions !== undefined) {
      let data2 = data.instructions;
      if (typeof data2 !== "string") {
        const err4 = {
          instancePath: instancePath + "/instructions",
          schemaPath: "#/properties/instructions/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema15.properties.instructions.type,
          parentSchema: schema15.properties.instructions,
          data: data2,
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.modId !== undefined) {
      let data3 = data.modId;
      if (!(typeof data3 == "number" && isFinite(data3))) {
        const err5 = {
          instancePath: instancePath + "/modId",
          schemaPath: "#/properties/modId/type",
          keyword: "type",
          params: { type: "number" },
          message: "must be number",
          schema: schema15.properties.modId.type,
          parentSchema: schema15.properties.modId,
          data: data3,
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.fileId !== undefined) {
      let data4 = data.fileId;
      if (!(typeof data4 == "number" && isFinite(data4))) {
        const err6 = {
          instancePath: instancePath + "/fileId",
          schemaPath: "#/properties/fileId/type",
          keyword: "type",
          params: { type: "number" },
          message: "must be number",
          schema: schema15.properties.fileId.type,
          parentSchema: schema15.properties.fileId,
          data: data4,
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.updatePolicy !== undefined) {
      let data5 = data.updatePolicy;
      if (typeof data5 !== "string") {
        const err7 = {
          instancePath: instancePath + "/updatePolicy",
          schemaPath: "#/definitions/UpdatePolicy/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema17.type,
          parentSchema: schema17,
          data: data5,
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
      if (!(data5 === "exact" || data5 === "latest" || data5 === "prefer")) {
        const err8 = {
          instancePath: instancePath + "/updatePolicy",
          schemaPath: "#/definitions/UpdatePolicy/enum",
          keyword: "enum",
          params: { allowedValues: schema17.enum },
          message: "must be equal to one of the allowed values",
          schema: schema17.enum,
          parentSchema: schema17,
          data: data5,
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.adultContent !== undefined) {
      let data6 = data.adultContent;
      if (typeof data6 !== "boolean") {
        const err9 = {
          instancePath: instancePath + "/adultContent",
          schemaPath: "#/properties/adultContent/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
          schema: schema15.properties.adultContent.type,
          parentSchema: schema15.properties.adultContent,
          data: data6,
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.md5 !== undefined) {
      let data7 = data.md5;
      if (typeof data7 !== "string") {
        const err10 = {
          instancePath: instancePath + "/md5",
          schemaPath: "#/properties/md5/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema15.properties.md5.type,
          parentSchema: schema15.properties.md5,
          data: data7,
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.fileSize !== undefined) {
      let data8 = data.fileSize;
      if (!(typeof data8 == "number" && isFinite(data8))) {
        const err11 = {
          instancePath: instancePath + "/fileSize",
          schemaPath: "#/properties/fileSize/type",
          keyword: "type",
          params: { type: "number" },
          message: "must be number",
          schema: schema15.properties.fileSize.type,
          parentSchema: schema15.properties.fileSize,
          data: data8,
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.logicalFilename !== undefined) {
      let data9 = data.logicalFilename;
      if (typeof data9 !== "string") {
        const err12 = {
          instancePath: instancePath + "/logicalFilename",
          schemaPath: "#/properties/logicalFilename/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema15.properties.logicalFilename.type,
          parentSchema: schema15.properties.logicalFilename,
          data: data9,
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.fileExpression !== undefined) {
      let data10 = data.fileExpression;
      if (typeof data10 !== "string") {
        const err13 = {
          instancePath: instancePath + "/fileExpression",
          schemaPath: "#/properties/fileExpression/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema15.properties.fileExpression.type,
          parentSchema: schema15.properties.fileExpression,
          data: data10,
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.tag !== undefined) {
      let data11 = data.tag;
      if (typeof data11 !== "string") {
        const err14 = {
          instancePath: instancePath + "/tag",
          schemaPath: "#/properties/tag/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema15.properties.tag.type,
          parentSchema: schema15.properties.tag,
          data: data11,
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
      params: { type: "object" },
      message: "must be object",
      schema: schema15.type,
      parentSchema: schema15,
      data,
    };
    if (vErrors === null) {
      vErrors = [err15];
    } else {
      vErrors.push(err15);
    }
    errors++;
  }
  validate13.errors = vErrors;
  return errors === 0;
}
function validate12(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.name === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "name" },
        message: "must have required property '" + "name" + "'",
        schema: schema14.required,
        parentSchema: schema14,
        data,
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.version === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "version" },
        message: "must have required property '" + "version" + "'",
        schema: schema14.required,
        parentSchema: schema14,
        data,
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.optional === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "optional" },
        message: "must have required property '" + "optional" + "'",
        schema: schema14.required,
        parentSchema: schema14,
        data,
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.domainName === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "domainName" },
        message: "must have required property '" + "domainName" + "'",
        schema: schema14.required,
        parentSchema: schema14,
        data,
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.source === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source" },
        message: "must have required property '" + "source" + "'",
        schema: schema14.required,
        parentSchema: schema14,
        data,
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.name !== undefined) {
      let data0 = data.name;
      if (typeof data0 !== "string") {
        const err5 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema14.properties.name.type,
          parentSchema: schema14.properties.name,
          data: data0,
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.version !== undefined) {
      let data1 = data.version;
      if (typeof data1 !== "string") {
        const err6 = {
          instancePath: instancePath + "/version",
          schemaPath: "#/properties/version/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema14.properties.version.type,
          parentSchema: schema14.properties.version,
          data: data1,
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.optional !== undefined) {
      let data2 = data.optional;
      if (typeof data2 !== "boolean") {
        const err7 = {
          instancePath: instancePath + "/optional",
          schemaPath: "#/properties/optional/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
          schema: schema14.properties.optional.type,
          parentSchema: schema14.properties.optional,
          data: data2,
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.domainName !== undefined) {
      let data3 = data.domainName;
      if (typeof data3 !== "string") {
        const err8 = {
          instancePath: instancePath + "/domainName",
          schemaPath: "#/properties/domainName/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema14.properties.domainName.type,
          parentSchema: schema14.properties.domainName,
          data: data3,
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.source !== undefined) {
      if (
        !validate13(data.source, {
          instancePath: instancePath + "/source",
          parentData: data,
          parentDataProperty: "source",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate13.errors
            : vErrors.concat(validate13.errors);
        errors = vErrors.length;
      }
    }
    if (data.patches !== undefined) {
      let data5 = data.patches;
      if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
        for (const key0 in data5) {
          let data6 = data5[key0];
          if (typeof data6 !== "string") {
            const err9 = {
              instancePath:
                instancePath +
                "/patches/" +
                key0.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath: "#/properties/patches/additionalProperties/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema14.properties.patches.additionalProperties.type,
              parentSchema: schema14.properties.patches.additionalProperties,
              data: data6,
            };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/patches",
          schemaPath: "#/properties/patches/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
          schema: schema14.properties.patches.type,
          parentSchema: schema14.properties.patches,
          data: data5,
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.instructions !== undefined) {
      let data7 = data.instructions;
      if (typeof data7 !== "string") {
        const err11 = {
          instancePath: instancePath + "/instructions",
          schemaPath: "#/properties/instructions/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema14.properties.instructions.type,
          parentSchema: schema14.properties.instructions,
          data: data7,
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.author !== undefined) {
      let data8 = data.author;
      if (typeof data8 !== "string") {
        const err12 = {
          instancePath: instancePath + "/author",
          schemaPath: "#/properties/author/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema14.properties.author.type,
          parentSchema: schema14.properties.author,
          data: data8,
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.details !== undefined) {
      let data9 = data.details;
      if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
        if (data9.type !== undefined) {
          let data10 = data9.type;
          if (typeof data10 !== "string") {
            const err13 = {
              instancePath: instancePath + "/details/type",
              schemaPath:
                "#/definitions/ICollectionModDetails/properties/type/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema18.properties.type.type,
              parentSchema: schema18.properties.type,
              data: data10,
            };
            if (vErrors === null) {
              vErrors = [err13];
            } else {
              vErrors.push(err13);
            }
            errors++;
          }
        }
        if (data9.category !== undefined) {
          let data11 = data9.category;
          if (typeof data11 !== "string") {
            const err14 = {
              instancePath: instancePath + "/details/category",
              schemaPath:
                "#/definitions/ICollectionModDetails/properties/category/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema18.properties.category.type,
              parentSchema: schema18.properties.category,
              data: data11,
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
          instancePath: instancePath + "/details",
          schemaPath: "#/definitions/ICollectionModDetails/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
          schema: schema18.type,
          parentSchema: schema18,
          data: data9,
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.phase !== undefined) {
      let data12 = data.phase;
      if (!(typeof data12 == "number" && isFinite(data12))) {
        const err16 = {
          instancePath: instancePath + "/phase",
          schemaPath: "#/properties/phase/type",
          keyword: "type",
          params: { type: "number" },
          message: "must be number",
          schema: schema14.properties.phase.type,
          parentSchema: schema14.properties.phase,
          data: data12,
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.fileOverrides !== undefined) {
      let data13 = data.fileOverrides;
      if (Array.isArray(data13)) {
        const len0 = data13.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data14 = data13[i0];
          if (typeof data14 !== "string") {
            const err17 = {
              instancePath: instancePath + "/fileOverrides/" + i0,
              schemaPath: "#/properties/fileOverrides/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema14.properties.fileOverrides.items.type,
              parentSchema: schema14.properties.fileOverrides.items,
              data: data14,
            };
            if (vErrors === null) {
              vErrors = [err17];
            } else {
              vErrors.push(err17);
            }
            errors++;
          }
        }
      } else {
        const err18 = {
          instancePath: instancePath + "/fileOverrides",
          schemaPath: "#/properties/fileOverrides/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
          schema: schema14.properties.fileOverrides.type,
          parentSchema: schema14.properties.fileOverrides,
          data: data13,
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
  } else {
    const err19 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
      schema: schema14.type,
      parentSchema: schema14,
      data,
    };
    if (vErrors === null) {
      vErrors = [err19];
    } else {
      vErrors.push(err19);
    }
    errors++;
  }
  validate12.errors = vErrors;
  return errors === 0;
}
const schema19 = {
  type: "object",
  properties: {
    source: { $ref: "#/definitions/IModReference" },
    type: { $ref: "#/definitions/RuleType" },
    reference: { $ref: "#/definitions/IModReference" },
  },
  required: ["source", "type", "reference"],
};
const schema20 = {
  type: "object",
  properties: {
    fileMD5: { type: "string" },
    fileSize: { type: "number" },
    gameId: { type: "string" },
    versionMatch: { type: "string" },
    logicalFileName: { type: "string" },
    fileExpression: { type: "string" },
    id: { type: "string" },
    idHint: { type: "string" },
    md5Hint: { type: "string" },
    tag: { type: "string" },
    archiveId: { type: "string" },
    repo: {
      type: "object",
      properties: {
        gameId: { type: "string" },
        modId: { type: "string" },
        fileId: { type: "string" },
        repository: { type: "string" },
        campaign: { type: "string" },
      },
      required: ["fileId", "repository"],
    },
    description: { type: "string" },
    instructions: { type: "string" },
  },
};
const schema21 = {
  type: "string",
  enum: ["before", "after", "requires", "conflicts", "recommends", "provides"],
};
function validate16(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.source === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source" },
        message: "must have required property '" + "source" + "'",
        schema: schema19.required,
        parentSchema: schema19,
        data,
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "type" },
        message: "must have required property '" + "type" + "'",
        schema: schema19.required,
        parentSchema: schema19,
        data,
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.reference === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "reference" },
        message: "must have required property '" + "reference" + "'",
        schema: schema19.required,
        parentSchema: schema19,
        data,
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.source !== undefined) {
      let data0 = data.source;
      if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
        if (data0.fileMD5 !== undefined) {
          let data1 = data0.fileMD5;
          if (typeof data1 !== "string") {
            const err3 = {
              instancePath: instancePath + "/source/fileMD5",
              schemaPath: "#/definitions/IModReference/properties/fileMD5/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.fileMD5.type,
              parentSchema: schema20.properties.fileMD5,
              data: data1,
            };
            if (vErrors === null) {
              vErrors = [err3];
            } else {
              vErrors.push(err3);
            }
            errors++;
          }
        }
        if (data0.fileSize !== undefined) {
          let data2 = data0.fileSize;
          if (!(typeof data2 == "number" && isFinite(data2))) {
            const err4 = {
              instancePath: instancePath + "/source/fileSize",
              schemaPath:
                "#/definitions/IModReference/properties/fileSize/type",
              keyword: "type",
              params: { type: "number" },
              message: "must be number",
              schema: schema20.properties.fileSize.type,
              parentSchema: schema20.properties.fileSize,
              data: data2,
            };
            if (vErrors === null) {
              vErrors = [err4];
            } else {
              vErrors.push(err4);
            }
            errors++;
          }
        }
        if (data0.gameId !== undefined) {
          let data3 = data0.gameId;
          if (typeof data3 !== "string") {
            const err5 = {
              instancePath: instancePath + "/source/gameId",
              schemaPath: "#/definitions/IModReference/properties/gameId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.gameId.type,
              parentSchema: schema20.properties.gameId,
              data: data3,
            };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors++;
          }
        }
        if (data0.versionMatch !== undefined) {
          let data4 = data0.versionMatch;
          if (typeof data4 !== "string") {
            const err6 = {
              instancePath: instancePath + "/source/versionMatch",
              schemaPath:
                "#/definitions/IModReference/properties/versionMatch/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.versionMatch.type,
              parentSchema: schema20.properties.versionMatch,
              data: data4,
            };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
        }
        if (data0.logicalFileName !== undefined) {
          let data5 = data0.logicalFileName;
          if (typeof data5 !== "string") {
            const err7 = {
              instancePath: instancePath + "/source/logicalFileName",
              schemaPath:
                "#/definitions/IModReference/properties/logicalFileName/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.logicalFileName.type,
              parentSchema: schema20.properties.logicalFileName,
              data: data5,
            };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
        if (data0.fileExpression !== undefined) {
          let data6 = data0.fileExpression;
          if (typeof data6 !== "string") {
            const err8 = {
              instancePath: instancePath + "/source/fileExpression",
              schemaPath:
                "#/definitions/IModReference/properties/fileExpression/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.fileExpression.type,
              parentSchema: schema20.properties.fileExpression,
              data: data6,
            };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
          }
        }
        if (data0.id !== undefined) {
          let data7 = data0.id;
          if (typeof data7 !== "string") {
            const err9 = {
              instancePath: instancePath + "/source/id",
              schemaPath: "#/definitions/IModReference/properties/id/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.id.type,
              parentSchema: schema20.properties.id,
              data: data7,
            };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
        if (data0.idHint !== undefined) {
          let data8 = data0.idHint;
          if (typeof data8 !== "string") {
            const err10 = {
              instancePath: instancePath + "/source/idHint",
              schemaPath: "#/definitions/IModReference/properties/idHint/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.idHint.type,
              parentSchema: schema20.properties.idHint,
              data: data8,
            };
            if (vErrors === null) {
              vErrors = [err10];
            } else {
              vErrors.push(err10);
            }
            errors++;
          }
        }
        if (data0.md5Hint !== undefined) {
          let data9 = data0.md5Hint;
          if (typeof data9 !== "string") {
            const err11 = {
              instancePath: instancePath + "/source/md5Hint",
              schemaPath: "#/definitions/IModReference/properties/md5Hint/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.md5Hint.type,
              parentSchema: schema20.properties.md5Hint,
              data: data9,
            };
            if (vErrors === null) {
              vErrors = [err11];
            } else {
              vErrors.push(err11);
            }
            errors++;
          }
        }
        if (data0.tag !== undefined) {
          let data10 = data0.tag;
          if (typeof data10 !== "string") {
            const err12 = {
              instancePath: instancePath + "/source/tag",
              schemaPath: "#/definitions/IModReference/properties/tag/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.tag.type,
              parentSchema: schema20.properties.tag,
              data: data10,
            };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
        }
        if (data0.archiveId !== undefined) {
          let data11 = data0.archiveId;
          if (typeof data11 !== "string") {
            const err13 = {
              instancePath: instancePath + "/source/archiveId",
              schemaPath:
                "#/definitions/IModReference/properties/archiveId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.archiveId.type,
              parentSchema: schema20.properties.archiveId,
              data: data11,
            };
            if (vErrors === null) {
              vErrors = [err13];
            } else {
              vErrors.push(err13);
            }
            errors++;
          }
        }
        if (data0.repo !== undefined) {
          let data12 = data0.repo;
          if (data12 && typeof data12 == "object" && !Array.isArray(data12)) {
            if (data12.fileId === undefined) {
              const err14 = {
                instancePath: instancePath + "/source/repo",
                schemaPath:
                  "#/definitions/IModReference/properties/repo/required",
                keyword: "required",
                params: { missingProperty: "fileId" },
                message: "must have required property '" + "fileId" + "'",
                schema: schema20.properties.repo.required,
                parentSchema: schema20.properties.repo,
                data: data12,
              };
              if (vErrors === null) {
                vErrors = [err14];
              } else {
                vErrors.push(err14);
              }
              errors++;
            }
            if (data12.repository === undefined) {
              const err15 = {
                instancePath: instancePath + "/source/repo",
                schemaPath:
                  "#/definitions/IModReference/properties/repo/required",
                keyword: "required",
                params: { missingProperty: "repository" },
                message: "must have required property '" + "repository" + "'",
                schema: schema20.properties.repo.required,
                parentSchema: schema20.properties.repo,
                data: data12,
              };
              if (vErrors === null) {
                vErrors = [err15];
              } else {
                vErrors.push(err15);
              }
              errors++;
            }
            if (data12.gameId !== undefined) {
              let data13 = data12.gameId;
              if (typeof data13 !== "string") {
                const err16 = {
                  instancePath: instancePath + "/source/repo/gameId",
                  schemaPath:
                    "#/definitions/IModReference/properties/repo/properties/gameId/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  schema: schema20.properties.repo.properties.gameId.type,
                  parentSchema: schema20.properties.repo.properties.gameId,
                  data: data13,
                };
                if (vErrors === null) {
                  vErrors = [err16];
                } else {
                  vErrors.push(err16);
                }
                errors++;
              }
            }
            if (data12.modId !== undefined) {
              let data14 = data12.modId;
              if (typeof data14 !== "string") {
                const err17 = {
                  instancePath: instancePath + "/source/repo/modId",
                  schemaPath:
                    "#/definitions/IModReference/properties/repo/properties/modId/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  schema: schema20.properties.repo.properties.modId.type,
                  parentSchema: schema20.properties.repo.properties.modId,
                  data: data14,
                };
                if (vErrors === null) {
                  vErrors = [err17];
                } else {
                  vErrors.push(err17);
                }
                errors++;
              }
            }
            if (data12.fileId !== undefined) {
              let data15 = data12.fileId;
              if (typeof data15 !== "string") {
                const err18 = {
                  instancePath: instancePath + "/source/repo/fileId",
                  schemaPath:
                    "#/definitions/IModReference/properties/repo/properties/fileId/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  schema: schema20.properties.repo.properties.fileId.type,
                  parentSchema: schema20.properties.repo.properties.fileId,
                  data: data15,
                };
                if (vErrors === null) {
                  vErrors = [err18];
                } else {
                  vErrors.push(err18);
                }
                errors++;
              }
            }
            if (data12.repository !== undefined) {
              let data16 = data12.repository;
              if (typeof data16 !== "string") {
                const err19 = {
                  instancePath: instancePath + "/source/repo/repository",
                  schemaPath:
                    "#/definitions/IModReference/properties/repo/properties/repository/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  schema: schema20.properties.repo.properties.repository.type,
                  parentSchema: schema20.properties.repo.properties.repository,
                  data: data16,
                };
                if (vErrors === null) {
                  vErrors = [err19];
                } else {
                  vErrors.push(err19);
                }
                errors++;
              }
            }
            if (data12.campaign !== undefined) {
              let data17 = data12.campaign;
              if (typeof data17 !== "string") {
                const err20 = {
                  instancePath: instancePath + "/source/repo/campaign",
                  schemaPath:
                    "#/definitions/IModReference/properties/repo/properties/campaign/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  schema: schema20.properties.repo.properties.campaign.type,
                  parentSchema: schema20.properties.repo.properties.campaign,
                  data: data17,
                };
                if (vErrors === null) {
                  vErrors = [err20];
                } else {
                  vErrors.push(err20);
                }
                errors++;
              }
            }
          } else {
            const err21 = {
              instancePath: instancePath + "/source/repo",
              schemaPath: "#/definitions/IModReference/properties/repo/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
              schema: schema20.properties.repo.type,
              parentSchema: schema20.properties.repo,
              data: data12,
            };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          }
        }
        if (data0.description !== undefined) {
          let data18 = data0.description;
          if (typeof data18 !== "string") {
            const err22 = {
              instancePath: instancePath + "/source/description",
              schemaPath:
                "#/definitions/IModReference/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.description.type,
              parentSchema: schema20.properties.description,
              data: data18,
            };
            if (vErrors === null) {
              vErrors = [err22];
            } else {
              vErrors.push(err22);
            }
            errors++;
          }
        }
        if (data0.instructions !== undefined) {
          let data19 = data0.instructions;
          if (typeof data19 !== "string") {
            const err23 = {
              instancePath: instancePath + "/source/instructions",
              schemaPath:
                "#/definitions/IModReference/properties/instructions/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.instructions.type,
              parentSchema: schema20.properties.instructions,
              data: data19,
            };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
      } else {
        const err24 = {
          instancePath: instancePath + "/source",
          schemaPath: "#/definitions/IModReference/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
          schema: schema20.type,
          parentSchema: schema20,
          data: data0,
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      let data20 = data.type;
      if (typeof data20 !== "string") {
        const err25 = {
          instancePath: instancePath + "/type",
          schemaPath: "#/definitions/RuleType/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          schema: schema21.type,
          parentSchema: schema21,
          data: data20,
        };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
      if (
        !(
          data20 === "before" ||
          data20 === "after" ||
          data20 === "requires" ||
          data20 === "conflicts" ||
          data20 === "recommends" ||
          data20 === "provides"
        )
      ) {
        const err26 = {
          instancePath: instancePath + "/type",
          schemaPath: "#/definitions/RuleType/enum",
          keyword: "enum",
          params: { allowedValues: schema21.enum },
          message: "must be equal to one of the allowed values",
          schema: schema21.enum,
          parentSchema: schema21,
          data: data20,
        };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.reference !== undefined) {
      let data21 = data.reference;
      if (data21 && typeof data21 == "object" && !Array.isArray(data21)) {
        if (data21.fileMD5 !== undefined) {
          let data22 = data21.fileMD5;
          if (typeof data22 !== "string") {
            const err27 = {
              instancePath: instancePath + "/reference/fileMD5",
              schemaPath: "#/definitions/IModReference/properties/fileMD5/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.fileMD5.type,
              parentSchema: schema20.properties.fileMD5,
              data: data22,
            };
            if (vErrors === null) {
              vErrors = [err27];
            } else {
              vErrors.push(err27);
            }
            errors++;
          }
        }
        if (data21.fileSize !== undefined) {
          let data23 = data21.fileSize;
          if (!(typeof data23 == "number" && isFinite(data23))) {
            const err28 = {
              instancePath: instancePath + "/reference/fileSize",
              schemaPath:
                "#/definitions/IModReference/properties/fileSize/type",
              keyword: "type",
              params: { type: "number" },
              message: "must be number",
              schema: schema20.properties.fileSize.type,
              parentSchema: schema20.properties.fileSize,
              data: data23,
            };
            if (vErrors === null) {
              vErrors = [err28];
            } else {
              vErrors.push(err28);
            }
            errors++;
          }
        }
        if (data21.gameId !== undefined) {
          let data24 = data21.gameId;
          if (typeof data24 !== "string") {
            const err29 = {
              instancePath: instancePath + "/reference/gameId",
              schemaPath: "#/definitions/IModReference/properties/gameId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.gameId.type,
              parentSchema: schema20.properties.gameId,
              data: data24,
            };
            if (vErrors === null) {
              vErrors = [err29];
            } else {
              vErrors.push(err29);
            }
            errors++;
          }
        }
        if (data21.versionMatch !== undefined) {
          let data25 = data21.versionMatch;
          if (typeof data25 !== "string") {
            const err30 = {
              instancePath: instancePath + "/reference/versionMatch",
              schemaPath:
                "#/definitions/IModReference/properties/versionMatch/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.versionMatch.type,
              parentSchema: schema20.properties.versionMatch,
              data: data25,
            };
            if (vErrors === null) {
              vErrors = [err30];
            } else {
              vErrors.push(err30);
            }
            errors++;
          }
        }
        if (data21.logicalFileName !== undefined) {
          let data26 = data21.logicalFileName;
          if (typeof data26 !== "string") {
            const err31 = {
              instancePath: instancePath + "/reference/logicalFileName",
              schemaPath:
                "#/definitions/IModReference/properties/logicalFileName/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.logicalFileName.type,
              parentSchema: schema20.properties.logicalFileName,
              data: data26,
            };
            if (vErrors === null) {
              vErrors = [err31];
            } else {
              vErrors.push(err31);
            }
            errors++;
          }
        }
        if (data21.fileExpression !== undefined) {
          let data27 = data21.fileExpression;
          if (typeof data27 !== "string") {
            const err32 = {
              instancePath: instancePath + "/reference/fileExpression",
              schemaPath:
                "#/definitions/IModReference/properties/fileExpression/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.fileExpression.type,
              parentSchema: schema20.properties.fileExpression,
              data: data27,
            };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
        }
        if (data21.id !== undefined) {
          let data28 = data21.id;
          if (typeof data28 !== "string") {
            const err33 = {
              instancePath: instancePath + "/reference/id",
              schemaPath: "#/definitions/IModReference/properties/id/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.id.type,
              parentSchema: schema20.properties.id,
              data: data28,
            };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
        }
        if (data21.idHint !== undefined) {
          let data29 = data21.idHint;
          if (typeof data29 !== "string") {
            const err34 = {
              instancePath: instancePath + "/reference/idHint",
              schemaPath: "#/definitions/IModReference/properties/idHint/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.idHint.type,
              parentSchema: schema20.properties.idHint,
              data: data29,
            };
            if (vErrors === null) {
              vErrors = [err34];
            } else {
              vErrors.push(err34);
            }
            errors++;
          }
        }
        if (data21.md5Hint !== undefined) {
          let data30 = data21.md5Hint;
          if (typeof data30 !== "string") {
            const err35 = {
              instancePath: instancePath + "/reference/md5Hint",
              schemaPath: "#/definitions/IModReference/properties/md5Hint/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.md5Hint.type,
              parentSchema: schema20.properties.md5Hint,
              data: data30,
            };
            if (vErrors === null) {
              vErrors = [err35];
            } else {
              vErrors.push(err35);
            }
            errors++;
          }
        }
        if (data21.tag !== undefined) {
          let data31 = data21.tag;
          if (typeof data31 !== "string") {
            const err36 = {
              instancePath: instancePath + "/reference/tag",
              schemaPath: "#/definitions/IModReference/properties/tag/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.tag.type,
              parentSchema: schema20.properties.tag,
              data: data31,
            };
            if (vErrors === null) {
              vErrors = [err36];
            } else {
              vErrors.push(err36);
            }
            errors++;
          }
        }
        if (data21.archiveId !== undefined) {
          let data32 = data21.archiveId;
          if (typeof data32 !== "string") {
            const err37 = {
              instancePath: instancePath + "/reference/archiveId",
              schemaPath:
                "#/definitions/IModReference/properties/archiveId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.archiveId.type,
              parentSchema: schema20.properties.archiveId,
              data: data32,
            };
            if (vErrors === null) {
              vErrors = [err37];
            } else {
              vErrors.push(err37);
            }
            errors++;
          }
        }
        if (data21.repo !== undefined) {
          let data33 = data21.repo;
          if (data33 && typeof data33 == "object" && !Array.isArray(data33)) {
            if (data33.fileId === undefined) {
              const err38 = {
                instancePath: instancePath + "/reference/repo",
                schemaPath:
                  "#/definitions/IModReference/properties/repo/required",
                keyword: "required",
                params: { missingProperty: "fileId" },
                message: "must have required property '" + "fileId" + "'",
                schema: schema20.properties.repo.required,
                parentSchema: schema20.properties.repo,
                data: data33,
              };
              if (vErrors === null) {
                vErrors = [err38];
              } else {
                vErrors.push(err38);
              }
              errors++;
            }
            if (data33.repository === undefined) {
              const err39 = {
                instancePath: instancePath + "/reference/repo",
                schemaPath:
                  "#/definitions/IModReference/properties/repo/required",
                keyword: "required",
                params: { missingProperty: "repository" },
                message: "must have required property '" + "repository" + "'",
                schema: schema20.properties.repo.required,
                parentSchema: schema20.properties.repo,
                data: data33,
              };
              if (vErrors === null) {
                vErrors = [err39];
              } else {
                vErrors.push(err39);
              }
              errors++;
            }
            if (data33.gameId !== undefined) {
              let data34 = data33.gameId;
              if (typeof data34 !== "string") {
                const err40 = {
                  instancePath: instancePath + "/reference/repo/gameId",
                  schemaPath:
                    "#/definitions/IModReference/properties/repo/properties/gameId/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  schema: schema20.properties.repo.properties.gameId.type,
                  parentSchema: schema20.properties.repo.properties.gameId,
                  data: data34,
                };
                if (vErrors === null) {
                  vErrors = [err40];
                } else {
                  vErrors.push(err40);
                }
                errors++;
              }
            }
            if (data33.modId !== undefined) {
              let data35 = data33.modId;
              if (typeof data35 !== "string") {
                const err41 = {
                  instancePath: instancePath + "/reference/repo/modId",
                  schemaPath:
                    "#/definitions/IModReference/properties/repo/properties/modId/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  schema: schema20.properties.repo.properties.modId.type,
                  parentSchema: schema20.properties.repo.properties.modId,
                  data: data35,
                };
                if (vErrors === null) {
                  vErrors = [err41];
                } else {
                  vErrors.push(err41);
                }
                errors++;
              }
            }
            if (data33.fileId !== undefined) {
              let data36 = data33.fileId;
              if (typeof data36 !== "string") {
                const err42 = {
                  instancePath: instancePath + "/reference/repo/fileId",
                  schemaPath:
                    "#/definitions/IModReference/properties/repo/properties/fileId/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  schema: schema20.properties.repo.properties.fileId.type,
                  parentSchema: schema20.properties.repo.properties.fileId,
                  data: data36,
                };
                if (vErrors === null) {
                  vErrors = [err42];
                } else {
                  vErrors.push(err42);
                }
                errors++;
              }
            }
            if (data33.repository !== undefined) {
              let data37 = data33.repository;
              if (typeof data37 !== "string") {
                const err43 = {
                  instancePath: instancePath + "/reference/repo/repository",
                  schemaPath:
                    "#/definitions/IModReference/properties/repo/properties/repository/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  schema: schema20.properties.repo.properties.repository.type,
                  parentSchema: schema20.properties.repo.properties.repository,
                  data: data37,
                };
                if (vErrors === null) {
                  vErrors = [err43];
                } else {
                  vErrors.push(err43);
                }
                errors++;
              }
            }
            if (data33.campaign !== undefined) {
              let data38 = data33.campaign;
              if (typeof data38 !== "string") {
                const err44 = {
                  instancePath: instancePath + "/reference/repo/campaign",
                  schemaPath:
                    "#/definitions/IModReference/properties/repo/properties/campaign/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  schema: schema20.properties.repo.properties.campaign.type,
                  parentSchema: schema20.properties.repo.properties.campaign,
                  data: data38,
                };
                if (vErrors === null) {
                  vErrors = [err44];
                } else {
                  vErrors.push(err44);
                }
                errors++;
              }
            }
          } else {
            const err45 = {
              instancePath: instancePath + "/reference/repo",
              schemaPath: "#/definitions/IModReference/properties/repo/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
              schema: schema20.properties.repo.type,
              parentSchema: schema20.properties.repo,
              data: data33,
            };
            if (vErrors === null) {
              vErrors = [err45];
            } else {
              vErrors.push(err45);
            }
            errors++;
          }
        }
        if (data21.description !== undefined) {
          let data39 = data21.description;
          if (typeof data39 !== "string") {
            const err46 = {
              instancePath: instancePath + "/reference/description",
              schemaPath:
                "#/definitions/IModReference/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.description.type,
              parentSchema: schema20.properties.description,
              data: data39,
            };
            if (vErrors === null) {
              vErrors = [err46];
            } else {
              vErrors.push(err46);
            }
            errors++;
          }
        }
        if (data21.instructions !== undefined) {
          let data40 = data21.instructions;
          if (typeof data40 !== "string") {
            const err47 = {
              instancePath: instancePath + "/reference/instructions",
              schemaPath:
                "#/definitions/IModReference/properties/instructions/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema20.properties.instructions.type,
              parentSchema: schema20.properties.instructions,
              data: data40,
            };
            if (vErrors === null) {
              vErrors = [err47];
            } else {
              vErrors.push(err47);
            }
            errors++;
          }
        }
      } else {
        const err48 = {
          instancePath: instancePath + "/reference",
          schemaPath: "#/definitions/IModReference/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
          schema: schema20.type,
          parentSchema: schema20,
          data: data21,
        };
        if (vErrors === null) {
          vErrors = [err48];
        } else {
          vErrors.push(err48);
        }
        errors++;
      }
    }
  } else {
    const err49 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
      schema: schema19.type,
      parentSchema: schema19,
      data,
    };
    if (vErrors === null) {
      vErrors = [err49];
    } else {
      vErrors.push(err49);
    }
    errors++;
  }
  validate16.errors = vErrors;
  return errors === 0;
}
function validate11(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.info === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "info" },
        message: "must have required property '" + "info" + "'",
        schema: schema12.required,
        parentSchema: schema12,
        data,
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.mods === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "mods" },
        message: "must have required property '" + "mods" + "'",
        schema: schema12.required,
        parentSchema: schema12,
        data,
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.modRules === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "modRules" },
        message: "must have required property '" + "modRules" + "'",
        schema: schema12.required,
        parentSchema: schema12,
        data,
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.plugins !== undefined) {
      let data0 = data.plugins;
      if (Array.isArray(data0)) {
        const len0 = data0.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data1 = data0[i0];
          if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
            if (data1.name === undefined) {
              const err3 = {
                instancePath: instancePath + "/plugins/" + i0,
                schemaPath: "#/properties/plugins/items/required",
                keyword: "required",
                params: { missingProperty: "name" },
                message: "must have required property '" + "name" + "'",
                schema: schema12.properties.plugins.items.required,
                parentSchema: schema12.properties.plugins.items,
                data: data1,
              };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors++;
            }
            if (data1.name !== undefined) {
              let data2 = data1.name;
              if (typeof data2 !== "string") {
                const err4 = {
                  instancePath: instancePath + "/plugins/" + i0 + "/name",
                  schemaPath: "#/properties/plugins/items/properties/name/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  schema:
                    schema12.properties.plugins.items.properties.name.type,
                  parentSchema:
                    schema12.properties.plugins.items.properties.name,
                  data: data2,
                };
                if (vErrors === null) {
                  vErrors = [err4];
                } else {
                  vErrors.push(err4);
                }
                errors++;
              }
            }
            if (data1.enabled !== undefined) {
              let data3 = data1.enabled;
              if (typeof data3 !== "boolean") {
                const err5 = {
                  instancePath: instancePath + "/plugins/" + i0 + "/enabled",
                  schemaPath:
                    "#/properties/plugins/items/properties/enabled/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                  schema:
                    schema12.properties.plugins.items.properties.enabled.type,
                  parentSchema:
                    schema12.properties.plugins.items.properties.enabled,
                  data: data3,
                };
                if (vErrors === null) {
                  vErrors = [err5];
                } else {
                  vErrors.push(err5);
                }
                errors++;
              }
            }
          } else {
            const err6 = {
              instancePath: instancePath + "/plugins/" + i0,
              schemaPath: "#/properties/plugins/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
              schema: schema12.properties.plugins.items.type,
              parentSchema: schema12.properties.plugins.items,
              data: data1,
            };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
        }
      } else {
        const err7 = {
          instancePath: instancePath + "/plugins",
          schemaPath: "#/properties/plugins/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
          schema: schema12.properties.plugins.type,
          parentSchema: schema12.properties.plugins,
          data: data0,
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.pluginRules !== undefined) {
      let data4 = data.pluginRules;
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
        if (data4.plugins === undefined) {
          const err8 = {
            instancePath: instancePath + "/pluginRules",
            schemaPath: "#/properties/pluginRules/required",
            keyword: "required",
            params: { missingProperty: "plugins" },
            message: "must have required property '" + "plugins" + "'",
            schema: schema12.properties.pluginRules.required,
            parentSchema: schema12.properties.pluginRules,
            data: data4,
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (data4.plugins !== undefined) {
          let data5 = data4.plugins;
          if (Array.isArray(data5)) {
            const len1 = data5.length;
            for (let i1 = 0; i1 < len1; i1++) {
              let data6 = data5[i1];
              if (data6 && typeof data6 == "object" && !Array.isArray(data6)) {
                if (data6.name === undefined) {
                  const err9 = {
                    instancePath: instancePath + "/pluginRules/plugins/" + i1,
                    schemaPath:
                      "#/properties/pluginRules/properties/plugins/items/required",
                    keyword: "required",
                    params: { missingProperty: "name" },
                    message: "must have required property '" + "name" + "'",
                    schema:
                      schema12.properties.pluginRules.properties.plugins.items
                        .required,
                    parentSchema:
                      schema12.properties.pluginRules.properties.plugins.items,
                    data: data6,
                  };
                  if (vErrors === null) {
                    vErrors = [err9];
                  } else {
                    vErrors.push(err9);
                  }
                  errors++;
                }
                if (data6.name !== undefined) {
                  let data7 = data6.name;
                  if (typeof data7 !== "string") {
                    const err10 = {
                      instancePath:
                        instancePath + "/pluginRules/plugins/" + i1 + "/name",
                      schemaPath:
                        "#/properties/pluginRules/properties/plugins/items/properties/name/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                      schema:
                        schema12.properties.pluginRules.properties.plugins.items
                          .properties.name.type,
                      parentSchema:
                        schema12.properties.pluginRules.properties.plugins.items
                          .properties.name,
                      data: data7,
                    };
                    if (vErrors === null) {
                      vErrors = [err10];
                    } else {
                      vErrors.push(err10);
                    }
                    errors++;
                  }
                }
                if (data6.group !== undefined) {
                  let data8 = data6.group;
                  if (typeof data8 !== "string") {
                    const err11 = {
                      instancePath:
                        instancePath + "/pluginRules/plugins/" + i1 + "/group",
                      schemaPath:
                        "#/properties/pluginRules/properties/plugins/items/properties/group/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                      schema:
                        schema12.properties.pluginRules.properties.plugins.items
                          .properties.group.type,
                      parentSchema:
                        schema12.properties.pluginRules.properties.plugins.items
                          .properties.group,
                      data: data8,
                    };
                    if (vErrors === null) {
                      vErrors = [err11];
                    } else {
                      vErrors.push(err11);
                    }
                    errors++;
                  }
                }
                if (data6.after !== undefined) {
                  let data9 = data6.after;
                  if (Array.isArray(data9)) {
                    const len2 = data9.length;
                    for (let i2 = 0; i2 < len2; i2++) {
                      let data10 = data9[i2];
                      if (typeof data10 !== "string") {
                        const err12 = {
                          instancePath:
                            instancePath +
                            "/pluginRules/plugins/" +
                            i1 +
                            "/after/" +
                            i2,
                          schemaPath:
                            "#/properties/pluginRules/properties/plugins/items/properties/after/items/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                          schema:
                            schema12.properties.pluginRules.properties.plugins
                              .items.properties.after.items.type,
                          parentSchema:
                            schema12.properties.pluginRules.properties.plugins
                              .items.properties.after.items,
                          data: data10,
                        };
                        if (vErrors === null) {
                          vErrors = [err12];
                        } else {
                          vErrors.push(err12);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err13 = {
                      instancePath:
                        instancePath + "/pluginRules/plugins/" + i1 + "/after",
                      schemaPath:
                        "#/properties/pluginRules/properties/plugins/items/properties/after/type",
                      keyword: "type",
                      params: { type: "array" },
                      message: "must be array",
                      schema:
                        schema12.properties.pluginRules.properties.plugins.items
                          .properties.after.type,
                      parentSchema:
                        schema12.properties.pluginRules.properties.plugins.items
                          .properties.after,
                      data: data9,
                    };
                    if (vErrors === null) {
                      vErrors = [err13];
                    } else {
                      vErrors.push(err13);
                    }
                    errors++;
                  }
                }
              } else {
                const err14 = {
                  instancePath: instancePath + "/pluginRules/plugins/" + i1,
                  schemaPath:
                    "#/properties/pluginRules/properties/plugins/items/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                  schema:
                    schema12.properties.pluginRules.properties.plugins.items
                      .type,
                  parentSchema:
                    schema12.properties.pluginRules.properties.plugins.items,
                  data: data6,
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
              instancePath: instancePath + "/pluginRules/plugins",
              schemaPath: "#/properties/pluginRules/properties/plugins/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
              schema: schema12.properties.pluginRules.properties.plugins.type,
              parentSchema: schema12.properties.pluginRules.properties.plugins,
              data: data5,
            };
            if (vErrors === null) {
              vErrors = [err15];
            } else {
              vErrors.push(err15);
            }
            errors++;
          }
        }
        if (data4.groups !== undefined) {
          let data11 = data4.groups;
          if (Array.isArray(data11)) {
            const len3 = data11.length;
            for (let i3 = 0; i3 < len3; i3++) {
              let data12 = data11[i3];
              if (
                data12 &&
                typeof data12 == "object" &&
                !Array.isArray(data12)
              ) {
                if (data12.name === undefined) {
                  const err16 = {
                    instancePath: instancePath + "/pluginRules/groups/" + i3,
                    schemaPath:
                      "#/properties/pluginRules/properties/groups/items/required",
                    keyword: "required",
                    params: { missingProperty: "name" },
                    message: "must have required property '" + "name" + "'",
                    schema:
                      schema12.properties.pluginRules.properties.groups.items
                        .required,
                    parentSchema:
                      schema12.properties.pluginRules.properties.groups.items,
                    data: data12,
                  };
                  if (vErrors === null) {
                    vErrors = [err16];
                  } else {
                    vErrors.push(err16);
                  }
                  errors++;
                }
                if (data12.name !== undefined) {
                  let data13 = data12.name;
                  if (typeof data13 !== "string") {
                    const err17 = {
                      instancePath:
                        instancePath + "/pluginRules/groups/" + i3 + "/name",
                      schemaPath:
                        "#/properties/pluginRules/properties/groups/items/properties/name/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                      schema:
                        schema12.properties.pluginRules.properties.groups.items
                          .properties.name.type,
                      parentSchema:
                        schema12.properties.pluginRules.properties.groups.items
                          .properties.name,
                      data: data13,
                    };
                    if (vErrors === null) {
                      vErrors = [err17];
                    } else {
                      vErrors.push(err17);
                    }
                    errors++;
                  }
                }
                if (data12.group !== undefined) {
                  let data14 = data12.group;
                  if (typeof data14 !== "string") {
                    const err18 = {
                      instancePath:
                        instancePath + "/pluginRules/groups/" + i3 + "/group",
                      schemaPath:
                        "#/properties/pluginRules/properties/groups/items/properties/group/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                      schema:
                        schema12.properties.pluginRules.properties.groups.items
                          .properties.group.type,
                      parentSchema:
                        schema12.properties.pluginRules.properties.groups.items
                          .properties.group,
                      data: data14,
                    };
                    if (vErrors === null) {
                      vErrors = [err18];
                    } else {
                      vErrors.push(err18);
                    }
                    errors++;
                  }
                }
                if (data12.after !== undefined) {
                  let data15 = data12.after;
                  if (Array.isArray(data15)) {
                    const len4 = data15.length;
                    for (let i4 = 0; i4 < len4; i4++) {
                      let data16 = data15[i4];
                      if (typeof data16 !== "string") {
                        const err19 = {
                          instancePath:
                            instancePath +
                            "/pluginRules/groups/" +
                            i3 +
                            "/after/" +
                            i4,
                          schemaPath:
                            "#/properties/pluginRules/properties/groups/items/properties/after/items/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                          schema:
                            schema12.properties.pluginRules.properties.groups
                              .items.properties.after.items.type,
                          parentSchema:
                            schema12.properties.pluginRules.properties.groups
                              .items.properties.after.items,
                          data: data16,
                        };
                        if (vErrors === null) {
                          vErrors = [err19];
                        } else {
                          vErrors.push(err19);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err20 = {
                      instancePath:
                        instancePath + "/pluginRules/groups/" + i3 + "/after",
                      schemaPath:
                        "#/properties/pluginRules/properties/groups/items/properties/after/type",
                      keyword: "type",
                      params: { type: "array" },
                      message: "must be array",
                      schema:
                        schema12.properties.pluginRules.properties.groups.items
                          .properties.after.type,
                      parentSchema:
                        schema12.properties.pluginRules.properties.groups.items
                          .properties.after,
                      data: data15,
                    };
                    if (vErrors === null) {
                      vErrors = [err20];
                    } else {
                      vErrors.push(err20);
                    }
                    errors++;
                  }
                }
              } else {
                const err21 = {
                  instancePath: instancePath + "/pluginRules/groups/" + i3,
                  schemaPath:
                    "#/properties/pluginRules/properties/groups/items/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                  schema:
                    schema12.properties.pluginRules.properties.groups.items
                      .type,
                  parentSchema:
                    schema12.properties.pluginRules.properties.groups.items,
                  data: data12,
                };
                if (vErrors === null) {
                  vErrors = [err21];
                } else {
                  vErrors.push(err21);
                }
                errors++;
              }
            }
          } else {
            const err22 = {
              instancePath: instancePath + "/pluginRules/groups",
              schemaPath: "#/properties/pluginRules/properties/groups/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
              schema: schema12.properties.pluginRules.properties.groups.type,
              parentSchema: schema12.properties.pluginRules.properties.groups,
              data: data11,
            };
            if (vErrors === null) {
              vErrors = [err22];
            } else {
              vErrors.push(err22);
            }
            errors++;
          }
        }
      } else {
        const err23 = {
          instancePath: instancePath + "/pluginRules",
          schemaPath: "#/properties/pluginRules/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
          schema: schema12.properties.pluginRules.type,
          parentSchema: schema12.properties.pluginRules,
          data: data4,
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.info !== undefined) {
      let data17 = data.info;
      if (data17 && typeof data17 == "object" && !Array.isArray(data17)) {
        if (data17.author === undefined) {
          const err24 = {
            instancePath: instancePath + "/info",
            schemaPath: "#/definitions/ICollectionInfo/required",
            keyword: "required",
            params: { missingProperty: "author" },
            message: "must have required property '" + "author" + "'",
            schema: schema13.required,
            parentSchema: schema13,
            data: data17,
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (data17.authorUrl === undefined) {
          const err25 = {
            instancePath: instancePath + "/info",
            schemaPath: "#/definitions/ICollectionInfo/required",
            keyword: "required",
            params: { missingProperty: "authorUrl" },
            message: "must have required property '" + "authorUrl" + "'",
            schema: schema13.required,
            parentSchema: schema13,
            data: data17,
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (data17.name === undefined) {
          const err26 = {
            instancePath: instancePath + "/info",
            schemaPath: "#/definitions/ICollectionInfo/required",
            keyword: "required",
            params: { missingProperty: "name" },
            message: "must have required property '" + "name" + "'",
            schema: schema13.required,
            parentSchema: schema13,
            data: data17,
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        if (data17.description === undefined) {
          const err27 = {
            instancePath: instancePath + "/info",
            schemaPath: "#/definitions/ICollectionInfo/required",
            keyword: "required",
            params: { missingProperty: "description" },
            message: "must have required property '" + "description" + "'",
            schema: schema13.required,
            parentSchema: schema13,
            data: data17,
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
        if (data17.domainName === undefined) {
          const err28 = {
            instancePath: instancePath + "/info",
            schemaPath: "#/definitions/ICollectionInfo/required",
            keyword: "required",
            params: { missingProperty: "domainName" },
            message: "must have required property '" + "domainName" + "'",
            schema: schema13.required,
            parentSchema: schema13,
            data: data17,
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
        if (data17.author !== undefined) {
          let data18 = data17.author;
          if (typeof data18 !== "string") {
            const err29 = {
              instancePath: instancePath + "/info/author",
              schemaPath:
                "#/definitions/ICollectionInfo/properties/author/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema13.properties.author.type,
              parentSchema: schema13.properties.author,
              data: data18,
            };
            if (vErrors === null) {
              vErrors = [err29];
            } else {
              vErrors.push(err29);
            }
            errors++;
          }
        }
        if (data17.authorUrl !== undefined) {
          let data19 = data17.authorUrl;
          if (typeof data19 !== "string") {
            const err30 = {
              instancePath: instancePath + "/info/authorUrl",
              schemaPath:
                "#/definitions/ICollectionInfo/properties/authorUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema13.properties.authorUrl.type,
              parentSchema: schema13.properties.authorUrl,
              data: data19,
            };
            if (vErrors === null) {
              vErrors = [err30];
            } else {
              vErrors.push(err30);
            }
            errors++;
          }
        }
        if (data17.name !== undefined) {
          let data20 = data17.name;
          if (typeof data20 !== "string") {
            const err31 = {
              instancePath: instancePath + "/info/name",
              schemaPath: "#/definitions/ICollectionInfo/properties/name/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema13.properties.name.type,
              parentSchema: schema13.properties.name,
              data: data20,
            };
            if (vErrors === null) {
              vErrors = [err31];
            } else {
              vErrors.push(err31);
            }
            errors++;
          }
        }
        if (data17.description !== undefined) {
          let data21 = data17.description;
          if (typeof data21 !== "string") {
            const err32 = {
              instancePath: instancePath + "/info/description",
              schemaPath:
                "#/definitions/ICollectionInfo/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema13.properties.description.type,
              parentSchema: schema13.properties.description,
              data: data21,
            };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
        }
        if (data17.domainName !== undefined) {
          let data22 = data17.domainName;
          if (typeof data22 !== "string") {
            const err33 = {
              instancePath: instancePath + "/info/domainName",
              schemaPath:
                "#/definitions/ICollectionInfo/properties/domainName/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              schema: schema13.properties.domainName.type,
              parentSchema: schema13.properties.domainName,
              data: data22,
            };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
        }
        if (data17.gameVersions !== undefined) {
          let data23 = data17.gameVersions;
          if (Array.isArray(data23)) {
            const len5 = data23.length;
            for (let i5 = 0; i5 < len5; i5++) {
              let data24 = data23[i5];
              if (typeof data24 !== "string") {
                const err34 = {
                  instancePath: instancePath + "/info/gameVersions/" + i5,
                  schemaPath:
                    "#/definitions/ICollectionInfo/properties/gameVersions/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  schema: schema13.properties.gameVersions.items.type,
                  parentSchema: schema13.properties.gameVersions.items,
                  data: data24,
                };
                if (vErrors === null) {
                  vErrors = [err34];
                } else {
                  vErrors.push(err34);
                }
                errors++;
              }
            }
          } else {
            const err35 = {
              instancePath: instancePath + "/info/gameVersions",
              schemaPath:
                "#/definitions/ICollectionInfo/properties/gameVersions/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
              schema: schema13.properties.gameVersions.type,
              parentSchema: schema13.properties.gameVersions,
              data: data23,
            };
            if (vErrors === null) {
              vErrors = [err35];
            } else {
              vErrors.push(err35);
            }
            errors++;
          }
        }
      } else {
        const err36 = {
          instancePath: instancePath + "/info",
          schemaPath: "#/definitions/ICollectionInfo/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
          schema: schema13.type,
          parentSchema: schema13,
          data: data17,
        };
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
    }
    if (data.mods !== undefined) {
      let data25 = data.mods;
      if (Array.isArray(data25)) {
        const len6 = data25.length;
        for (let i6 = 0; i6 < len6; i6++) {
          if (
            !validate12(data25[i6], {
              instancePath: instancePath + "/mods/" + i6,
              parentData: data25,
              parentDataProperty: i6,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate12.errors
                : vErrors.concat(validate12.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err37 = {
          instancePath: instancePath + "/mods",
          schemaPath: "#/properties/mods/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
          schema: schema12.properties.mods.type,
          parentSchema: schema12.properties.mods,
          data: data25,
        };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
    }
    if (data.modRules !== undefined) {
      let data27 = data.modRules;
      if (Array.isArray(data27)) {
        const len7 = data27.length;
        for (let i7 = 0; i7 < len7; i7++) {
          if (
            !validate16(data27[i7], {
              instancePath: instancePath + "/modRules/" + i7,
              parentData: data27,
              parentDataProperty: i7,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate16.errors
                : vErrors.concat(validate16.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err38 = {
          instancePath: instancePath + "/modRules",
          schemaPath: "#/properties/modRules/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
          schema: schema12.properties.modRules.type,
          parentSchema: schema12.properties.modRules,
          data: data27,
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
    }
  } else {
    const err39 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
      schema: schema12.type,
      parentSchema: schema12,
      data,
    };
    if (vErrors === null) {
      vErrors = [err39];
    } else {
      vErrors.push(err39);
    }
    errors++;
  }
  validate11.errors = vErrors;
  return errors === 0;
}
function validate10(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  const _errs1 = errors;
  if (
    !validate11(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
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
      data,
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
