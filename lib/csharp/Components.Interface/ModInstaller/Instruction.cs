namespace Components.Interface
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

        public static Instruction CreateIniEdit(string edit)
        {
            return new Instruction()
            {
                type = "iniedit",
                source = edit,
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
                type = "warning",
                source = function,
            };
        }

        public string type;
        public string source;
        public string destination;
    }
}
