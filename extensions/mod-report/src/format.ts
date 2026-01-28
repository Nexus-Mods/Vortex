import { IFileEntry, IReport } from "./IReport";

const deployedFilter = (file: IFileEntry) =>
  file.deployed && file.md5sum !== null && file.overwrittenBy === null;
const overwrittenFilter = (file: IFileEntry) =>
  file.deployed && file.md5sum !== null && file.overwrittenBy !== null;
const missingFilter = (file: IFileEntry) =>
  file.deployed && file.md5sum === null && file.error === "ENOENT";
const errorFilter = (file: IFileEntry) =>
  file.deployed && file.md5sum === null && file.error !== "ENOENT";
const undeployedFilter = (file: IFileEntry) => !file.deployed;

interface IFormatter {
  section: (title: string, content: string | string[]) => string;
  list: (items: string[]) => string;
  lines: (items: string[]) => string;
  preformatted: (input: string) => string;
  strong: (input: string) => string;
  em: (input: string) => string;
  header: (input: string) => string;
  code: (input: string) => string;
  escape: (input: string) => string;
}

export class FormatterReadable implements IFormatter {
  private static DIVIDER = "*".repeat(50);

  public section(title: string, content: string | string[]): string {
    if (Array.isArray(content)) {
      content = this.list(content);
    }
    return [
      FormatterReadable.DIVIDER,
      `* ${title}`,
      FormatterReadable.DIVIDER,
      content,
      "",
    ].join("\n");
  }

  public lines(items: string[]): string {
    if (items.length === 0) {
      return this.em("None");
    }
    return items.join("\n");
  }

  public list(items: string[]): string {
    if (items.length === 0) {
      return this.em("None");
    }
    return items.join("\n");
  }

  public preformatted(input: string): string {
    return input;
  }

  public strong(input: string): string {
    return input;
  }

  public em(input: string): string {
    return `<${input}>`;
  }

  public header(input: string): string {
    return "*** " + input;
  }

  public code(input: string): string {
    return input;
  }

  public escape(input: string): string {
    return input;
  }
}

export class FormatterMarkdown implements IFormatter {
  public section(summary: string, content: string | string[]): string {
    if (Array.isArray(content)) {
      return (
        "<details>\n" +
        `  <summary>${summary} (${content.length})</summary>\n` +
        "\n" +
        `${this.lines(content)}\n` +
        "</details>\n"
      );
    } else {
      return `<details>\n  <summary>${summary}</summary>\n${content}\n</details>\n`;
    }
  }

  public lines(items: string[]): string {
    if (items.length === 0) {
      return this.em("None");
    }
    return items.join("  \n");
  }

  public list(items: string[]): string {
    if (items.length === 0) {
      return this.em("None");
    }
    return items.map((item) => `* ${item}`).join("\n");
  }

  public preformatted(input: string): string {
    return "\n```\n" + input + "\n```\n";
  }

  public strong(input: string): string {
    return `__${input}__`;
  }

  public em(input: string): string {
    return `_${input}_`;
  }

  public header(input: string): string {
    return "#### " + input;
  }

  public code(input: string): string {
    return "`" + input + "`";
  }

  public escape(input: string): string {
    return input.replace(/[_*]/g, (m) => `\\${m}`);
  }
}

export class FormatterBBCode implements IFormatter {
  public section(summary: string, content: string | string[]): string {
    if (Array.isArray(content)) {
      return (
        `${summary} (${content.length})` +
        "[br][/br]" +
        `${this.lines(content)}` +
        "[br][/br]"
      );
    } else {
      return `${summary}[br][/br]${content}[br][/br]`;
    }
  }

  public lines(items: string[]): string {
    if (items.length === 0) {
      return this.em("None");
    }
    return items.join("[br][/br]");
  }

  public list(items: string[]): string {
    if (items.length === 0) {
      return this.em("None");
    }
    return `[list]${items.map((item) => `[*]${item}`).join("\n")}[/list]`;
  }

  public preformatted(input: string): string {
    return `[br][/br][pre]${input}[/pre][br][/br]`;
  }

  public strong(input: string): string {
    return `[b]${input}[/b]`;
  }

  public em(input: string): string {
    return `[i]${input}[/i]`;
  }

  public header(input: string): string {
    return `[b][size=12]${input}[/size][/b]`;
  }

  public code(input: string): string {
    return `[code=inline]${input}[/code]`;
  }

  public escape(input: string): string {
    return input.replace(/[\[\]]/g, (m) => `\\${m}`);
  }
}

function format(formatter: IFormatter, input: IReport): string {
  const fileList = (
    filter: (file: IFileEntry) => boolean,
    print: (file: IFileEntry) => string,
  ) => {
    return input.files.filter(filter).map(print);
  };

  const e = (text: string) => formatter.escape(text);

  const lines = [
    formatter.header(
      `Vortex mod report for: ${formatter.escape(input.mod.name)}`,
    ),
    formatter.em(
      "This report was automatically generated by Vortex using the information from the reporter's " +
        "installation, including any alterations - intentional or otherwise - they may have made to the data.",
    ),
    formatter.section(
      "Mod details",
      formatter.list([
        `${formatter.strong("Mod name")}: ${e(input.mod.name)}`,
        `${formatter.strong("Version")}: ${e(input.mod.version)}`,
        `${formatter.strong("Archive")}: ${e(input.mod.archiveName)}`,
        `${formatter.strong("Mod type")}: ${e(input.mod.modType)}`,
        `${formatter.strong("Managed game")}: ${e(input.mod.managedGame)}`,
        `${formatter.strong("Mod intended for")}: ${e(input.mod.intendedGame)}`,
        `${formatter.strong("MD5 checksum")}: ${input.mod.md5sum}`,
        `${formatter.strong("Download source")}: ${e(input.mod.source)} (mod ${input.mod.modId}, file ${input.mod.fileId})`,
        `${formatter.strong("Last deployment")}: ${input.mod.deploymentTime === 0 ? "Unknown" : new Date(input.mod.deploymentTime).toUTCString()}`,
        `${formatter.strong("Deployment method")}: ${e(input.mod.deploymentMethod)}`,
      ]),
    ),
    formatter.section(
      "Deployed files",
      fileList(
        deployedFilter,
        (file) => `${formatter.code(file.path)} (${file.md5sum})`,
      ),
    ),
    formatter.section(
      "Files overwritten by other mod",
      fileList(
        overwrittenFilter,
        (file) =>
          `${formatter.code(file.path)} (${file.md5sum}) - ${formatter.code(file.overwrittenBy)}`,
      ),
    ),
    formatter.section(
      "Files not deployed",
      fileList(undeployedFilter, (file) => `${formatter.code(file.path)}`),
    ),
    formatter.section(
      "Files that are supposed to be deployed but weren't found",
      fileList(missingFilter, (file) => `${formatter.code(file.path)}`),
    ),
    formatter.section(
      "Files that are present but couldn't be read",
      fileList(
        errorFilter,
        (file) => `${formatter.code(file.path)} (${file.error})`,
      ),
    ),
  ];

  if (input.loadOrder !== undefined) {
    if (input.plugins !== undefined) {
      // Gamebryo game.
      const ownedPlugins = new Set(
        input.plugins.map((plugin) => plugin.name.toLowerCase()),
      );
      lines.push(
        formatter.section(
          "Plugins",
          input.plugins.map(
            (plugin) =>
              `${formatter.code(plugin.name)} (${plugin.enabled ? "Enabled" : "Disabled"})`,
          ),
        ),
      );
      lines.push(
        formatter.section(
          "Load order",
          formatter.preformatted(
            input.loadOrder
              .map((plugin) =>
                ownedPlugins.has(plugin.name)
                  ? `+ ${plugin.name}`
                  : `  ${plugin.name}`,
              )
              .join("\n"),
          ),
        ),
      );
    } else {
      // Any game with a defined Load order, is probably using the generic LO extension
      const entryToLine = (entry) => {
        const enabled = entry.enabled ? "Enabled" : "Disabled";
        const locked = !!entry?.locked ? "Locked" : "Unlocked";
        const external = !!entry?.external ? "External" : "";
        return `${entry.name} (${enabled}/${locked}) ${external}`;
      };
      lines.push(
        formatter.section(
          "Load order",
          formatter.preformatted(
            input.loadOrder
              .map((loEntry, idx) =>
                input.mod.archiveName.indexOf(loEntry.name) !== -1
                  ? `+ ${idx} ${entryToLine(loEntry)}`
                  : `  ${idx} ${entryToLine(loEntry)}`,
              )
              .join("\n"),
          ),
        ),
      );
    }
  }

  return formatter.lines(lines);
}

export default format;
