using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Utils;

namespace ModInstaller
{
    /// <summary>
    /// Class with helper functions to analyze the structure of an archive
    /// </summary>
    class ArchiveStructure
    {
        private FileTree m_ftFiles;
        private ISet<string> m_setIgnore = new HashSet<string> { "__MACOSX" };

        public ArchiveStructure(IEnumerable<String> files)
        {
            // convert all paths to lower case since the FileTree is implemented case sensitive
            m_ftFiles = new FileTree(files.Select(path => path.ToLowerInvariant()));
        }

        /// <summary>
        /// This searches through the structure recursively to find one one of the stop folders and returns
        /// the path up to there.
        /// This is used to determine the path "prefix" that should be ignored in scripted installers (
        /// the scripts specify paths relative to this prefix)
        /// </summary>
        public string FindPathPrefix(IEnumerable<string> stopDirectories, IEnumerable<string> stopFiles)
        {
            Regex dirExpression = new Regex(String.Join("|", stopDirectories));
            Regex fileExpression = new Regex(String.Join("|", stopFiles));

            Stack<string> stkPaths = new Stack<string>();
            stkPaths.Push("");

            while (stkPaths.Count > 0)
            {
                string strSourcePath = stkPaths.Pop();

                FileTree node = m_ftFiles.SelectDirectory(strSourcePath);
                string[] directories = node.SubDirectories
                    .Select(dir => dir.Name)
                    .Where(name => !m_setIgnore.Contains(name))
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
