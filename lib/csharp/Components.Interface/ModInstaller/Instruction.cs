using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Components.Interface.ModInstaller
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

        public string type;
        public string source;
        public string destination;
    }
}
