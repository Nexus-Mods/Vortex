using NSubstitute;
using System.IO;
using System.Text;
using Util;
using Xunit;

namespace Scripting.Tests
{
	public class DataFileUtilTests
	{
		private DataFileUtil setup(IFileSystem fileUtil = null)
		{
			if (fileUtil == null)
			{
				fileUtil = Substitute.For<IFileSystem>();
			}
			return new DataFileUtil(fileUtil, @"c:\game");
		}

		[Theory]
		[InlineData(@"data")]
		[InlineData(@"data\textures")]
		// TODO  [InlineData(@"c:\game\data")]
		// TODO  [InlineData(@"data\textures\..")]
		public void AssertFilePathIsSafeTrue(string path)
		{
			setup().AssertFilePathIsSafe(path);	
		}

		[Theory]
		[InlineData(@"c:\windows")]  // absolute path
		[InlineData(@"..\windows")]  // relative outside the path
		public void AssertFilePathIsSafeFalse(string path)
		{
			Assert.Throws<Scripting.IllegalFilePathException>(() => setup().AssertFilePathIsSafe(path));
		}

		[Fact]
		public void DataFileExistsTest()
		{
			IFileSystem system = Substitute.For<IFileSystem>();
			system.Exists("").ReturnsForAnyArgs(false);
			system.Exists(@"c:\game\datafile.txt").Returns(true);

			DataFileUtil util = setup(system);

			Assert.True(util.DataFileExists("datafile.txt"));
			Assert.False(util.DataFileExists("otherfile.txt"));
		}

		[Fact]
		public void GetExistingDataFileListTest()
		{
			IFileSystem system = Substitute.For<IFileSystem>();
			system.GetFiles(@"c:\game\.", "*.txt", SearchOption.AllDirectories).Returns(new string[] { "datafile.txt", "anotherfile.txt" });

			DataFileUtil util = setup(system);
			string[] res = util.GetExistingDataFileList(".", "*.txt", true);

			Assert.Equal(new string[] { "datafile.txt", "anotherfile.txt" }, res);
		}

		[Fact]
		public void GetExistingDataFileTest()
		{
			const string FILE_NAME = "datafile.txt";
			IFileSystem system = Substitute.For<IFileSystem>();
			system.Exists("").ReturnsForAnyArgs(false);
			system.Exists(@"c:\game\" + FILE_NAME).Returns(true);
			system.ReadAllBytes(@"c:\game\" + FILE_NAME).Returns(Encoding.ASCII.GetBytes("Hello World"));
			
			DataFileUtil util = setup(system);

			Assert.Equal(Encoding.ASCII.GetBytes("Hello World"), util.GetExistingDataFile(FILE_NAME));
		}
	}
}