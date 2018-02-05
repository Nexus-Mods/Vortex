using Xunit;
using System.Collections.Generic;
using System.Threading.Tasks;
using FomodInstaller.Interface;
using Xunit.Abstractions;

namespace FomodInstaller.ModInstaller.Tests
{

	public class InstallerTests
	{

		private readonly ITestOutputHelper output;

		public InstallerTests(ITestOutputHelper output)
		{
			this.output = output;
		}


		[Theory]
		[InlineData(0, new object[] { "test.esm", "test.esp" })]
		[InlineData(0, new object[] { })]
		public async Task TestSupported(int dummy, List<string> modArchiveFileList)
		{

			Assert.Empty(modArchiveFileList);

			Installer installer = new Installer();
			var actual = await installer.TestSupported(modArchiveFileList);

			// Xunit test
			Assert.Null(actual);
			Assert.NotNull(actual);
			output.WriteLine("This is output from {0}", actual);
		}

		[Theory()]
		// empty ProgressDelegate and CoreDelegates
		[InlineData(0, new object[] { "test.esm", "test.esp" }, "C:\\Xunit\\TEST", null , null)]
		[InlineData(0, new object[] { }, "C:\\Xunit\\TEST", null, null)]
		[InlineData(0, new object[] { "test.esm", "test.esp" }, "", null, null)]
		[InlineData(0, new object[] { "test.esm", "test.esp" }, "C:\\Xunit\\TEST", null, null)]
		[InlineData(0, new object[] { "test.esm", "test.esp" }, "C:\\Xunit\\TEST", null, null)]
		public async Task Install(int dummy, List<string> modArchiveFileList, List<string> gameSpecificStopFolders,
            string destinationPath, ProgressDelegate progressDelegate, CoreDelegates coreDelegate)
		{
			Assert.Empty(modArchiveFileList);
            Assert.Empty(gameSpecificStopFolders);
			Assert.Empty(destinationPath);
			Assert.NotNull(progressDelegate);
			Assert.NotNull(coreDelegate);

			Installer installer = new Installer();
			var actual = await installer.Install(modArchiveFileList, gameSpecificStopFolders, "", destinationPath, progressDelegate, coreDelegate);

			// Xunit test
			Assert.Null(actual);
			Assert.NotNull(actual);
			output.WriteLine("This is output from {0}", actual);
		}
	}
}