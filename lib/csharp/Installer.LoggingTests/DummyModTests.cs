using Xunit;
using Installer.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.IO;
using Mods;
using NSubstitute;

namespace Installer.Logging.Tests
{
	public class DummyModTests
	{
		[Fact]
		public void GetFileTest()
		{
			InstallLog.DummyMod mod = new InstallLog.DummyMod("dummy", "dummy.zip");

			// dummy mod contains no files
			Assert.Throws<FileNotFoundException>(() => mod.GetFile("anyfile.txt"));
		}

		[Fact]
		public void GetFileListTest()
		{
			InstallLog.DummyMod mod = new InstallLog.DummyMod("dummy", "dummy.zip");
			// file list is always empty
			Assert.Empty(mod.GetFileList());
		}

		[Theory]
		[InlineData("", true)]
		[InlineData("", false)]
		[InlineData("/somepath", true)]
		[InlineData("/somepath", false)]
		[InlineData("/invalid/?*<>#", true)]
		public void GetFileListTest1(string path, bool recurse)
		{
			InstallLog.DummyMod mod = new InstallLog.DummyMod("dummy", "dummy.zip");
			// getfilelist really doesn't care about the path, it always returns an empty list
			Assert.Empty(mod.GetFileList(path, recurse));
		}

		[Fact]
		public void IsMatchingVersionTest()
		{
			InstallLog.DummyMod mod = new InstallLog.DummyMod("dummy", "dummy.zip");
			Assert.True(mod.IsMatchingVersion(), "dummy mod is always up-to-date");
		}


		[Fact]
		public void UpdateInfoTest()
		{
			InstallLog.DummyMod mod = new InstallLog.DummyMod("dummy", "dummy.zip");
			IModInfo info = Substitute.For<IModInfo>();
			info.HumanReadableVersion.Returns("1.0");
			mod.UpdateInfo(info, true);
			Assert.Equal(info.HumanReadableVersion, mod.HumanReadableVersion);
		}
	}
}