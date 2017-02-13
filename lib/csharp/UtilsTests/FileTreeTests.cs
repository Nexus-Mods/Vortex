using Xunit;
using System.Linq;

namespace Utils.Tests
{
    public class FileTreeTests
    {
        [Fact()]
        public void ParsesInputTree()
        {
            FileTree tree = new FileTree(new string[] {
                "top\\middle\\end\\",
                "top\\middle\\end\\somefile.txt",
                "toplevel.txt"
            });

            Assert.Equal(tree.Files, new string[] { "toplevel.txt" });
            Assert.Equal(tree.SubDirectories.Select(dir => dir.Name),
                new string[] { "top" });
            Assert.Empty(tree.SubDirectories.First().Files);
            Assert.Equal(tree.SubDirectories.First().SubDirectories.Select(dir => dir.Name),
                new string[] { "middle" });
        }

        [Fact()]
        public void AlsoWorksWithSlashes()
        {
            FileTree tree = new FileTree(new string[] {
                "top/middle/end/",
                "top/middle/end/somefile.txt",
                "toplevel.txt"
            });

            Assert.Equal(tree.Files, new string[] { "toplevel.txt" });
            Assert.Equal(tree.SubDirectories.Select(dir => dir.Name),
                new string[] { "top" });
        }

        [Fact()]
        public void CanSelectToplevel()
        {
            FileTree tree = new FileTree(new string[] {
                @"top\middle\end\",
                @"top\middle\end\somefile.txt",
                "toplevel.txt"
            });

            Assert.Equal(tree.SelectDirectory("/").Files, new string[] { "toplevel.txt" });
        }


        [Fact()]
        public void CanSelectAnywhere()
        {
            FileTree tree = new FileTree(new string[] {
                @"top\middle\end\",
                @"top\middle\end\somefile.txt",
                "toplevel.txt"
            });

            Assert.Equal(tree.SelectDirectory("/top/middle").SubDirectories.Select(node => node.Name),
                new string[] { "end" });
        }

        [Fact()]
        public void DirectoriesDontHaveToExist()
        {
            FileTree tree = new FileTree(new string[] {
                "top/middle/end/somefile.txt",
            });

            Assert.Equal(tree.SelectDirectory("/top/middle/end").Files,
                new string[] { "somefile.txt" });
        }
    }
}