import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseAllQueries } from "../../src/main/store/queryParser";

describe("queryParser", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qparser-"));
    fs.mkdirSync(path.join(tmpDir, "setup"));
    fs.mkdirSync(path.join(tmpDir, "select"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses @alias annotation", () => {
    fs.writeFileSync(
      path.join(tmpDir, "select", "test.sql"),
      `-- @type select\n-- @name my_long_query_name\n-- @alias myQuery\nSELECT 1;\n`
    );

    const queries = parseAllQueries(tmpDir);

    expect(queries).toHaveLength(1);
    expect(queries[0].name).toBe("my_long_query_name");
    expect(queries[0].alias).toBe("myQuery");
  });

  it("alias is undefined when not specified", () => {
    fs.writeFileSync(
      path.join(tmpDir, "select", "test.sql"),
      `-- @type select\n-- @name simple_query\nSELECT 1;\n`
    );

    const queries = parseAllQueries(tmpDir);

    expect(queries[0].alias).toBeUndefined();
  });

  it("parses @alias on setup queries", () => {
    fs.writeFileSync(
      path.join(tmpDir, "setup", "test.sql"),
      `-- @type setup\n-- @name my_pivot\n-- @alias myModel\nSELECT 1;\n`
    );

    const queries = parseAllQueries(tmpDir);

    expect(queries[0].alias).toBe("myModel");
  });
});
