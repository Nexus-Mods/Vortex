import * as path from "node:path";
import { constants as fsConstants } from "node:fs";
import { writeFile, readFile, access, readdir } from "node:fs/promises";

const importRegex = /import\s.*?from\s['"](.*?)['"]/g;
const requireRegex = /require\(['"](.*?)['"]\)/g;
const regexToRun = [importRegex, requireRegex];

type Imports = { sourceFile: string, moduleImports: string[], fileImports: string[] };

async function extractImportsFromDirectory(rootDirectory: string): Promise<Imports[]> {
    const files = await readdir(rootDirectory, { recursive: true });
    const sourceFiles = files.filter(file => file.endsWith(".ts") || file.endsWith(".tsx"));

    const results = await Promise.all(sourceFiles.map(file => extractImportsFromFile(rootDirectory, path.join(rootDirectory, file))));
    return results;
}

async function extractImportsFromFile(rootDirectory: string, filePath: string): Promise<Imports> {
    console.debug("extracting imports from", filePath);

    const contents = await readFile(filePath, "utf-8");
    const results = await Promise.all(regexToRun.map(regex => runRegex(regex, contents, rootDirectory, filePath)));

    const moduleImports = new Set(results.reduce<string[]>((prev, cur) => {
        prev.push(...cur.moduleImports);
        return prev;
    }, []));

    const fileImports = new Set(results.reduce<string[]>((prev, cur) => {
        prev.push(...cur.fileImports);
        return prev;
    }, []));

    const sourceFile = filePath.substring(rootDirectory.length + 1);
    return { sourceFile, moduleImports: [...moduleImports], fileImports: [...fileImports] };
}

async function runRegex(regex: RegExp, contents: string, rootDirectory: string, filePath: string): Promise<Omit<Imports, "sourceFile">> {
    const moduleImports: string[] = [];
    const fileImports: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = regex.exec(contents))) {
        const importPath = match[1];

        if (!importPath.startsWith(".")) {
            moduleImports.push(importPath);
            continue;
        }

        const resolvedPath = path.resolve(path.dirname(filePath), importPath);

        if (await exists(resolvedPath + ".ts")) {
            const fullPath = resolvedPath + ".ts";
            const sourceFile = fullPath.substring(rootDirectory.length + 1);
            fileImports.push(sourceFile);
        } else if (await exists(resolvedPath + ".tsx")) {
            const fullPath = resolvedPath + ".tsx";
            const sourceFile = fullPath.substring(rootDirectory.length + 1);
            fileImports.push(sourceFile);
        }
    }

    return { moduleImports, fileImports };
}

async function exists(filePath: string): Promise<boolean> {
    try {
        await access(filePath, fsConstants.F_OK | fsConstants.R_OK);
        return true;
    } catch {
        return false;
    }
}

async function main(): Promise<void> {
    const argument = process.argv[2];
    if (!argument) {
        console.error("missing argument");
        return;
    }

    const rootDirectory = path.resolve(path.join(process.cwd(), argument));
    console.log("using root directory", rootDirectory);

    const results = await extractImportsFromDirectory(rootDirectory);
    const json = JSON.stringify(results);

    await writeFile(path.join(process.cwd(), "output.json"), json);
    console.log("written output JSON");

    await gephiExport(results);
}

async function gephiExport(results: Imports[]): Promise<void> {
    const nodes: string[] = [];
    const edges: Array<[string, string]> = [];

    for (const entry of results) {
        nodes.push(entry.sourceFile);

        for (const fileImport of entry.fileImports) {
            edges.push([entry.sourceFile, fileImport]);
        }
    }

    const nodesCSV = "id,label,project\n" + nodes.map(n => {
        let project = "unknown";
        const index = n.indexOf("/");
        if (index === -1) {
            project = "root";
        } else {
            project = n.substring(0, index);
        }
        return `${n},${n},${project}`;
    }).join("\n");
    const edgesCSV = "source,target,type\n" + edges.map(([source, target]) => `${source},${target},Directed`).join("\n");

    await writeFile(path.join(process.cwd(), "nodes.csv"), nodesCSV);
    await writeFile(path.join(process.cwd(), "edges.csv"), edgesCSV);

    console.log("exported nodes.csv and edges.csv");
}

await main();


