using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Components.Extensions;
using Utils;

namespace Components.Interface
{
    /// <summary>
    /// Class with helper functions to analyze the structure of an archive
    /// </summary>
    class ArchiveStructure
    {
        private FileTree m_ftFiles;
        private ISet<string> m_setIgnore = new HashSet<string> { "__MACOSX" };

        public ArchiveStructure(IEnumerable<string> files)
        {
            // convert all paths to lower case since the FileTree is implemented case sensitive
            m_ftFiles = new FileTree(files);
        }

        /// <summary>
        /// This searches through the structure recursively to find one one of the stop folders and returns
        /// the path up to there.
        /// This is used to determine the path "prefix" that should be ignored in scripted installers (
        /// the scripts specify paths relative to this prefix)
        /// </summary>
        public string FindPathPrefix(IEnumerable<string> stopDirectories, IEnumerable<string> stopFiles)
        {
            List<string> MatchDirectories = stopDirectories.Select(x => "^" + x + "$").ToList();
            Regex dirExpression = new Regex(string.Join("|", MatchDirectories), RegexOptions.IgnoreCase);
            Regex fileExpression = new Regex(string.Join("|", stopFiles), RegexOptions.IgnoreCase);

            Stack<string> stkPaths = new Stack<string>();
            stkPaths.Push("");

            while (stkPaths.Count > 0)
            {
                string strSourcePath = stkPaths.Pop();

                FileTree node = m_ftFiles.SelectDirectory(strSourcePath);
                string[] directories = node.SubDirectories
                    .Select(dir => dir.Name)
                    .Where(name => !m_setIgnore.Contains(name, StringComparer.InvariantCultureIgnoreCase))
                    .ToArray();

                foreach (string strDirectory in directories)
                {
                    stkPaths.Push(Path.Combine(strSourcePath, strDirectory));
                    if (dirExpression.IsMatch(strDirectory))
                    {
                        return strSourcePath;
                    }
                }

                foreach (string strFile in node.Files)
                {
                    if (fileExpression.IsMatch(strFile))
                    {
                        return strSourcePath;
                    }
                }
            }

            return null;
        }
    }
}
