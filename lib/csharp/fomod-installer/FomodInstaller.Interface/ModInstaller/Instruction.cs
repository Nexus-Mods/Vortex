namespace FomodInstaller.Interface
{
    public struct Instruction
    {
        public static Instruction CreateCopy(string source, string destination)
        {
            return new Instruction()
            {
                type = "copy",
                source = source,
                destination = destination,
            };
        }

        public static Instruction CreateMKDir(string destination)
        {
            return new Instruction()
            {
                type = "mkdir",
                destination = destination,
            };
        }

        public static Instruction GenerateFile(string byteSource, string destination)
        {
            return new Instruction()
            {
                type = "generatefile",
                source = byteSource,
                destination = destination,
            };
        }

        public static Instruction CreateIniEdit(string fileName, string section, string key, string value)
        {
            return new Instruction()
            {
                type = "iniedit",
                destination = fileName,
                section = section,
                key = key,
                value = value,
            };
        }

        public static Instruction EnablePlugin(string plugin)
        {
            return new Instruction()
            {
                type = "enableplugin",
                source = plugin,
            };
        }

        public static Instruction EnableAllPlugins()
        {
            return new Instruction()
            {
                type = "enableallplugins",
            };
        }

        public static Instruction UnsupportedFunctionalityWarning(string function)
        {
            return new Instruction()
            {
                type = "unsupported",
                source = function,
            };
        }

        public static Instruction InstallError(string message)
        {
            return new Instruction()
            {
                type = "error",
                source = message,
            };
        }

        public string type;
        public string source;
        public string destination;
        public string section;
        public string key;
        public string value;
    }
}
