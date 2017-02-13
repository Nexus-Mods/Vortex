using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Utils
{
    public class FileTree
    {
        public IEnumerable<FileTree> SubDirectories { get; private set; }
        public IEnumerable<string> Files { get; private set; }
        public string Name { get; private set; }

        public FileTree(IEnumerable<string> paths)
        {
            Name = "/";
            IEnumerable<string[]> pathsSegmented = paths.Select(path => path.Split(PathSeparators, StringSplitOptions.None));
            InsertPaths(pathsSegmented);
        }

        public FileTree(string name, IEnumerable<string[]> paths)
        {
            Name = name;
            InsertPaths(paths);
        }

        public FileTree SelectDirectory(string path)
        {
            return SelectDirectory(path.Split(PathSeparators, StringSplitOptions.RemoveEmptyEntries));
        }

        private static char[] PathSeparators = new char[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar };

        private void InsertPaths(IEnumerable<string[]> pathsSegmented)
        {
            // we assume directories have a tailing separator so they would have at least two path segments, the latter of which
            // is empty
            Files = pathsSegmented.Where(path => path.Length == 1).Select(path => path[0]);

            // group the remaining paths by the first path element, then turn each group into a new tree
            SubDirectories = pathsSegmented
                .Where(path => path.Length > 1)
                .GroupBy(path => path[0])
                .Select(group => new FileTree(group.Key, group.Select(path => path.Skip(1).ToArray())));
        }

        private FileTree SelectDirectory(string[] path)
        {
            // make the top level directory selectable by passing an empty path
            //if ((path.Length == 0) || ((path.Length == 1) && (path[0].Length == 1) && (PathSeparators.Contains(path[0][0]))))
            if (path.Length == 0)
            {
                return this;
            }

            FileTree sub = SubDirectories.First(subDir => subDir.Name == path[0]);
            if ((sub != null) && (path.Length > 1))
            {
                return sub.SelectDirectory(path.Skip(1).ToArray());
            } else
            {
                return sub;
            }
        }
    }
}
