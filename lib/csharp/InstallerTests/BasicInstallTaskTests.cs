using GameMode;
using Mods;
using NSubstitute;
using System;
using System.Collections.Generic;
using Util.Collections;
using Xunit;

namespace Scripting.Tests
{
	public class BasicInstallTaskTests
	{
		IMod mod;
		IModFileInstaller fileInstaller;

		BasicInstallTask CreateTask(Func<string, bool> filter)
		{
			mod = Substitute.For<IMod>();

			IGameMode mode = Substitute.For<IGameMode>();
			mode.GetModFormatAdjustedPath(null, "", true).ReturnsForAnyArgs(args => args[1]);
			mode.GetModFormatAdjustedPath(null, "", null, true).ReturnsForAnyArgs(args => args[1]);

			fileInstaller = Substitute.For<IModFileInstaller>();
			ThreadSafeObservableList<IMod> activeMods = new ThreadSafeObservableList<IMod>();
			ReadOnlyObservableList<IMod> activeModsObservable = new ReadOnlyObservableList<IMod>(activeMods);

			return new BasicInstallTask(mod, mode, fileInstaller, @"c:\temp", activeModsObservable, filter);
		}

		[Fact]
		public void ExecuteTestFailsIfNoFiles()
		{
			BasicInstallTask task = CreateTask(null);
			Assert.Throws<ArgumentNullException>(() => task.Execute());
		}

		[Fact]
		public void ExecuteTest()
		{
			BasicInstallTask task = CreateTask(null);
			mod.GetFileList().Returns(new List<string>() { "filea.txt", "fileb.txt" });
			Assert.True(task.Execute());
			fileInstaller.Received(1).InstallFileFromMod("filea.txt", @"c:\temp\filea.txt");
			fileInstaller.Received(1).InstallFileFromMod("fileb.txt", @"c:\temp\fileb.txt");
		}

		[Fact]
		public void ExecuteFilterTest()
		{
			BasicInstallTask task = CreateTask(filename => filename != "fileb.txt");
			mod.GetFileList().Returns(new List<string>() { "filea.txt", "fileb.txt" });
			Assert.True(task.Execute());
			fileInstaller.Received(1).InstallFileFromMod("filea.txt", @"c:\temp\filea.txt");
			fileInstaller.DidNotReceive().InstallFileFromMod("fileb.txt", @"c:\temp\fileb.txt");
		}
	}
}