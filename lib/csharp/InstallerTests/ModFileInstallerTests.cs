using ChinhDo.Transactions.FileManager;
using GameMode;
using Installer.Logging;
using Mods;
using NSubstitute;
using PluginManagement;
using Scripting;
using System;
using System.IO;
using System.Text;
using UI;
using Util;
using Xunit;

namespace Installer.Tests
{
	public class ModFileInstallerTests
	{
		IGameModeEnvironmentInfo envInfo;
		IMod mod;
		IInstallLog installLog;
		IFileManager fileManager;
		IFileSystem fileSystem;
		IPluginManager pluginManager;

		ModFileInstaller CreateInstaller(bool usePlugins = false)
		{
			envInfo = Substitute.For<IGameModeEnvironmentInfo>();
			mod = Substitute.For<IMod>();
			mod.GetFile(@"c:\mod\missing").Returns((byte[])null).AndDoes((CallInfo) => { throw new FileNotFoundException(); });
			installLog = Substitute.For<IInstallLog>();
			pluginManager = Substitute.For<IPluginManager>();
			IDataFileUtil dataFileUtil = Substitute.For<IDataFileUtil>();
			fileManager = Substitute.For<IFileManager>();
			fileSystem = Substitute.For<IFileSystem>();

			ConfirmItemOverwriteDelegate overwriteDelegate = (string msg, bool perGroup, bool perMode) => OverwriteResult.No;

			return new ModFileInstaller(envInfo, mod, installLog, pluginManager, dataFileUtil, fileManager,
				overwriteDelegate, fileSystem, usePlugins);
		}


		[Fact]
		public void InstallFileFromModMissingTest()
		{
			ModFileInstaller installer = CreateInstaller();

			Assert.False(installer.InstallFileFromMod(@"c:\mod\missing", @"c:\install\path"));
		}

		[Fact]
		public void InstallFileFromModTest()
		{
			ModFileInstaller installer = CreateInstaller();

			byte[] fileData = Encoding.ASCII.GetBytes("Hello World");

			mod.GetFile(@"c:\mod\path").Returns(fileData).AndDoes((CallInfo) => { });

			Assert.True(installer.InstallFileFromMod(@"c:\mod\path", @"c:\install\path"));

			installLog.Received(1).AddDataFile(mod, @"c:\install\path");
			fileManager.Received(1).CreateDirectory(@"c:\install");
			fileManager.Received(1).WriteAllBytes(@"c:\install\path", fileData);
		}

		[Fact]
		public void GenerateDataFileTest()
		{
			ModFileInstaller installer = CreateInstaller();

			byte[] fileData = Encoding.ASCII.GetBytes("Hello World");

			Assert.True(installer.GenerateDataFile(@"c:\install\path", fileData));
			installLog.Received(1).AddDataFile(mod, @"c:\install\path");
			fileManager.Received(1).CreateDirectory(@"c:\install");
			fileManager.Received(1).WriteAllBytes(@"c:\install\path", fileData);
		}

		[Fact]
		public void GenerateDataFileOverrideTest()
		{
			ModFileInstaller installer = CreateInstaller();

			fileSystem.Exists(@"c:\install").Returns(true);
			fileSystem.Exists(@"c:\install\path").Returns(true);

			byte[] fileData = Encoding.ASCII.GetBytes("Hello World");

			Assert.False(installer.GenerateDataFile(@"c:\install\path", fileData));

			installLog.DidNotReceive().AddDataFile(mod, @"c:\install\path");
			fileManager.DidNotReceive().CreateDirectory(@"c:\install");
			fileManager.DidNotReceive().WriteAllBytes(@"c:\install\path", fileData);
		}

		[Fact]
		public void PluginCheckNoPluginsTest()
		{
			ModFileInstaller installer = CreateInstaller();

			Assert.False(installer.PluginCheck(@"c:\install\path.esp", false));
		}

		[Fact]
		public void PluginCheckTest()
		{
			ModFileInstaller installer = CreateInstaller(true);
			pluginManager.CanActivatePlugins().Returns(true);
			pluginManager.IsActivatiblePluginFile(@"c:\install\path.esp").Returns(true);

			Assert.True(installer.PluginCheck(@"c:\install\path.esp", false));

			pluginManager.Received(1).AddPlugin(@"c:\install\path.esp");
		}

		[Fact]
		public void PluginCheckTooManyTest()
		{
			ModFileInstaller installer = CreateInstaller(true);
			pluginManager.CanActivatePlugins().Returns(false);
			pluginManager.IsActivatiblePluginFile(@"c:\install\path.esp").Returns(true);

			Assert.Throws<Exception>(() => installer.PluginCheck(@"c:\install\path.esp", false));
		}

		[Fact]
		public void UninstallDataFileTest()
		{
			ModFileInstaller installer = CreateInstaller();

			string filePath = @"c:\install\path";

			fileSystem.Exists(filePath).Returns(true);

			IFileInfo info = Substitute.For<IFileInfo>();
			info.IsReadOnly.Returns(false);

			fileSystem.GetFileInfo(filePath).Returns(info);
			// make sure the uninstaller thinks the fle belongs ot the right mod
			installLog.GetModKey(null).ReturnsForAnyArgs("moda");
			installLog.GetCurrentFileOwnerKey(filePath).Returns("moda");
			// do not restore anything
			installLog.GetPreviousFileOwnerKey(filePath).Returns((string)null);

			// UninstallDataFile doesn't return whether the operation was successful
			// but whether a file was restored. So if it returns true, the file
			// is still there but provided by a different mod
			Assert.False(installer.UninstallDataFile(filePath));

			fileManager.Received(1).Delete(filePath);
			installLog.RemoveDataFile(mod, filePath);
		}

		[Fact]
		public void GenerateDataFileTest1()
		{
			ModFileInstaller installer = CreateInstaller();

			fileSystem.Exists(@"c:\install").Returns(true);
			fileSystem.Exists(@"c:\install\path").Returns(false);

			byte[] fileData = Encoding.ASCII.GetBytes("Hello World");

			// TODO from the function documentation I'm expecting true??
			Assert.True(installer.GenerateDataFile(@"c:\install\path\genfile.dat", fileData, true));

			installLog.Received(1).AddDataFile(mod, @"c:\install\path");
			fileManager.Received(1).WriteAllBytes(@"c:\install\path", fileData);
		}

		[Fact]
		public void UninstallDataFileTest1()
		{
			ModFileInstaller installer = CreateInstaller();

			string filePath = @"c:\install\path";

			fileSystem.Exists(filePath).Returns(true);

			IFileInfo info = Substitute.For<IFileInfo>();
			info.IsReadOnly.Returns(false);

			fileSystem.GetFileInfo(filePath).Returns(info);
			// make sure the uninstaller thinks the fle belongs ot the right mod
			installLog.GetModKey(null).ReturnsForAnyArgs("moda");
			installLog.GetCurrentFileOwnerKey(filePath).Returns("moda");
			// do not restore anything
			installLog.GetPreviousFileOwnerKey(filePath).Returns((string)null);

			Assert.False(installer.UninstallDataFile(filePath));

			fileManager.Received(1).Delete(filePath);
			installLog.RemoveDataFile(mod, filePath);
		}
	}
}