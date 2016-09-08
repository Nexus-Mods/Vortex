using ChinhDo.Transactions.FileManager;
using Installer.Logging;
using Mods;
using NSubstitute;
using System.Collections.Generic;
using UI;
using Xunit;

namespace IniEditing.Tests
{
	public class IniEditorTests
	{
		const string INI_FILE = "settings.ini";
		const string SECTION = "section";

		private ConfirmItemOverwriteDelegate NopDelegate()
		{
			return (msg, perGroup, perMod) => { return OverwriteResult.Yes; };
		}

		private IInstallLog CreateLog()
		{
			Dictionary<string, IMod> modMap = new Dictionary<string, IMod>();

			IInstallLog log = Substitute.For<IInstallLog>();

			IMod orig = Substitute.For<IMod>();
			orig.ModName.Returns("orig");
			modMap["str"] = orig;
			modMap["int"] = orig;

			log
				.When(obj => obj.AddIniEdit(Arg.Any<IMod>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>()))
				.Do(args => modMap[(string)args[3]] = (IMod)args[0]);

			log.GetCurrentIniEditOwner("", "", "").ReturnsForAnyArgs(x =>
			{
				IMod result;
				modMap.TryGetValue((string)x[2], out result);
				return result;
			});
			log.GetCurrentIniEditOwnerKey("", "", "").ReturnsForAnyArgs(x => modMap[(string)x[2]].ModName);
			log.GetModKey(null).ReturnsForAnyArgs(args => ((IMod)args[0]).ModName);

			log.GetPreviousIniValue(INI_FILE, SECTION, "str").Returns("strval");
			log.GetPreviousIniValue(INI_FILE, SECTION, "int").Returns("42");

			return log;
		}

		private IniEditor Create(ConfirmItemOverwriteDelegate overwriteDelegate, IInstallLog inLog = null, IIniMethods methods = null)
		{
			IMod mod = Substitute.For<IMod>();
			mod.ModName.Returns("test");

			IIniMethods iniMethods = methods ?? Substitute.For<IIniMethods>();
			IInstallLog log = inLog ?? CreateLog();
			IFileManager fileManager = Substitute.For<IFileManager>();

			iniMethods
				.GetPrivateProfileString(SECTION, "str", Arg.Any<string>(), INI_FILE)
				.Returns("strval");

			iniMethods
				.GetPrivateProfileInt32(SECTION, "int", Arg.Any<int>(), INI_FILE)
				.Returns(42);

			return new IniEditor(mod, log, iniMethods, fileManager, overwriteDelegate);
		}

		[Fact]
		public void GetIniStringTest()
		{
			IniEditor iniEdit = Create(NopDelegate());
			Assert.Equal("strval", iniEdit.GetIniString(INI_FILE, SECTION, "str"));
		}

		[Fact]
		public void GetIniIntTest()
		{
			IniEditor iniEdit = Create(NopDelegate());
			Assert.Equal(42, iniEdit.GetIniInt(INI_FILE, SECTION, "int"));
			Assert.Equal(0, iniEdit.GetIniInt(INI_FILE, SECTION, "str"));
		}

		[Fact]
		public void EditIniTest()
		{
			int delegateCount = 0;
			ConfirmItemOverwriteDelegate yesDelegate = (msg, perGroup, perMod) => { ++delegateCount; return OverwriteResult.Yes; };
			IIniMethods iniMethods = Substitute.For<IIniMethods>();
			IniEditor iniEdit = Create(yesDelegate, null, iniMethods);

			Assert.True(iniEdit.EditIni(INI_FILE, SECTION, "new", "foobar"));
			// the delegate is invoked even when creating a new value
			Assert.Equal(1, delegateCount);

			Assert.True(iniEdit.EditIni(INI_FILE, SECTION, "str", "overwrite"));
			Assert.Equal(2, delegateCount);

			Assert.True(iniEdit.EditIni(INI_FILE, SECTION, "str", "overwrite"));
			// should call the delegate again even though it's the same key and value
			Assert.Equal(3, delegateCount);

			iniMethods.Received(1).WritePrivateProfileString(SECTION, "new", "foobar", INI_FILE);
			iniMethods.Received(2).WritePrivateProfileString(SECTION, "str", "overwrite", INI_FILE);
		}

		[Fact]
		public void EditIniNoToAllTest()
		{
			int delegateCount = 0;
			ConfirmItemOverwriteDelegate noToAll = (msg, perGroup, perMod) => { ++delegateCount; return OverwriteResult.NoToAll; };
			IIniMethods iniMethods = Substitute.For<IIniMethods>();
			IniEditor iniEdit = Create(noToAll, null, iniMethods);
			Assert.True(iniEdit.EditIni(INI_FILE, SECTION, "new", "foobar"), "should not trigger the overwrite delegate");
			Assert.False(iniEdit.EditIni(INI_FILE, SECTION, "str", "overwrite"), "delegate rejects");
			Assert.False(iniEdit.EditIni(INI_FILE, SECTION, "int", "13"), "already rejected");
			// the delegate should only be called once if a "ToAll" selection was made
			Assert.Equal(1, delegateCount);
			iniMethods.Received().WritePrivateProfileString(SECTION, "new", "foobar", INI_FILE);
			iniMethods.DidNotReceive().WritePrivateProfileString(SECTION, "str", Arg.Any<string>(), INI_FILE);
			iniMethods.DidNotReceive().WritePrivateProfileString(SECTION, "int", Arg.Any<string>(), INI_FILE);
		}

		[Fact]
		public void EditIniYesToAllTest()
		{
			int delegateCount = 0;
			ConfirmItemOverwriteDelegate yesToAll = (msg, perGroup, perMod) => { delegateCount += 1; return OverwriteResult.YesToAll; };
			IIniMethods iniMethods = Substitute.For<IIniMethods>();
			IniEditor iniEdit = Create(yesToAll, null, iniMethods);
			Assert.True(iniEdit.EditIni(INI_FILE, SECTION, "new", "foobar"), "should not trigger the overwrite delegate");
			Assert.True(iniEdit.EditIni(INI_FILE, SECTION, "str", "overwrite"), "delegate accepts");
			Assert.True(iniEdit.EditIni(INI_FILE, SECTION, "int", "13"), "already accepted");
			// the delegate should only be called once if a "ToAll" selection was made
			Assert.Equal(1, delegateCount);

			iniMethods.Received().WritePrivateProfileString(SECTION, "new", "foobar", INI_FILE);
			iniMethods.Received().WritePrivateProfileString(SECTION, "str", "overwrite", INI_FILE);
			iniMethods.Received().WritePrivateProfileString(SECTION, "int", "13", INI_FILE);
		}

		[Fact]
		public void UneditIniTest()
		{
			IIniMethods iniMethods = Substitute.For<IIniMethods>();
			IniEditor iniEdit = Create(NopDelegate(), null, iniMethods);

			Assert.False(iniEdit.UneditIni(INI_FILE, SECTION, "str"), "wasn't changed by us");

			iniEdit.EditIni(INI_FILE, SECTION, "str", "change");

			Assert.True(iniEdit.UneditIni(INI_FILE, SECTION, "str"), "was changed by us");

			iniMethods.Received().WritePrivateProfileString(SECTION, "str", "change", INI_FILE);
			iniMethods.Received().WritePrivateProfileString(SECTION, "str", "strval", INI_FILE);
		}
	}
}