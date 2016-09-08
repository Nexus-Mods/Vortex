using Xunit;
using Installer.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Mods;
using NSubstitute;
using System.IO;
using GameMode;
using Util.Collections;

namespace Installer.Logging.Tests
{
	public class InstallLogTests : IDisposable
	{
		const string INSTALL_PATH = @"c:\mods";

		const string LOG_VERSION = "0.5.0.0";

		const string SAMPLE_INI = ""
			+ @"<installLog fileVersion=""" + LOG_VERSION + @""">"
			+ @"  <modList>"
			+ @"    <mod path=""Dummy Mod: ORIGINAL_VALUE"" key=""pwd3gvsk"" >"
			+ @"      <version machineVersion=""0.0"" />"
			+ @"      <name>ORIGINAL_VALUE</name>"
			+ @"      <installDate>01.08.2016 00:00:00</installDate>"
			+ @"    </mod>"
			+ @"    <mod path=""basefile.zip"" key=""abc"">"
			+ @"      <version machineVersion=""1.0"">1.0</version>"
			+ @"      <name>base</name>"
			+ @"      <installDate>01.08.2016 00:00:00</installDate>"
			+ @"    </mod>"
			+ @"  </modList>"
			+ @"  <dataFiles>"
			+ @"    <file path=""c:\game\data\afile.xyz"">"
			+ @"      <installingMods>"
			+ @"        <mod key=""abc"" />"
			+ @"      </installingMods>"
			+ @"    </file>"
			+ @"  </dataFiles>"
			+ @"  <iniEdits>"
			+ @"    <ini file=""wootwoot.ini"" section=""somesec"" key=""somekey"">"
			+ @"      <mod key=""abc"">somevalue</mod>"
			+ @"    </ini>"
			+ @"  </iniEdits>"
			+ @"  <gameSpecificEdits>"
			+ @"    <edit key=""editKey"">"
			+ @"      <installingMods>"
			+ @"        <mod key=""abc"">dmFsdWU=</mod>"
			+ @"      </installingMods>"
			+ @"    </edit>"
			+ @"  </gameSpecificEdits>"
			+ @"</installLog>";

		private IModRegistry registry;


		#region IDisposable Support
		private bool disposedValue = false;

		protected virtual void Dispose(bool disposing)
		{
			if (!disposedValue)
			{
				if (disposing)
				{
					InstallLog.Release();
				}

				disposedValue = true;
			}
		}

		public void Dispose()
		{
			Dispose(true);
		}
		#endregion

		private MemoryStream InitStream(string data)
		{
			MemoryStream stream = new MemoryStream();
			byte[] buf = Encoding.Unicode.GetBytes(data);
			stream.Write(buf, 0, buf.Length);
			stream.Seek(0, SeekOrigin.Begin);
			return stream;
		}

		IInstallLog CreateInstallLog(Stream stream)
		{
			registry = Substitute.For<IModRegistry>();
			IMod abcMod = CreateMod("base", "1.0");
			registry.GetMod(@"c:\mods\basefile.zip").Returns(abcMod);

			IGameMode gameMode = Substitute.For<IGameMode>();
			gameMode.GetModFormatAdjustedPath(null, "", false).ReturnsForAnyArgs(args => (string)args[1]);

			return InstallLog.Initialize(registry, gameMode, INSTALL_PATH, stream);
		}

		IMod CreateMod(string name, string version)
		{
			IMod newMod = Substitute.For<IMod>();
			newMod.ModName.Returns(name);
			newMod.Filename.Returns(name + "file.zip");
			newMod.ModArchivePath.Returns(@"c:\mods\" + name + "file.zip");
			newMod.HumanReadableVersion.Returns(version);
			newMod.MachineVersion.Returns(new Version(version));

			return newMod;
		}

		[Fact]
		public void InitializeSingletonTest()
		{
			IModRegistry registry = Substitute.For<IModRegistry>();
			IGameMode gameMode = Substitute.For<IGameMode>();

			string input = "<installLog fileVersion=\"" + LOG_VERSION + "\"></installLog>";

			using (MemoryStream stream = InitStream(input)) {
				IInstallLog log = InstallLog.Initialize(registry, gameMode, INSTALL_PATH, stream);
				Assert.Throws<InvalidOperationException>(() => {
					InstallLog.Initialize(registry, gameMode, INSTALL_PATH, stream);
				});
			}
		}

		[Fact]
		public void ReInitializeTest()
		{
			IModRegistry registry = Substitute.For<IModRegistry>();
			IGameMode gameMode = Substitute.For<IGameMode>();

			string input = "<installLog fileVersion=\"" + LOG_VERSION + "\"></installLog>";

			using (MemoryStream stream = InitStream(input)) {
				IInstallLog log = InstallLog.Initialize(registry, gameMode, INSTALL_PATH, stream);
				stream.Seek(0, SeekOrigin.Begin);
				log.ReInitialize(stream);
			}
		}

		[Fact]
		public void ReadVersionTest()
		{
			string input = "<installLog fileVersion=\"" + LOG_VERSION + "\"></installLog>";

			using (MemoryStream stream = InitStream(input)) {
				Version ver = InstallLog.ReadVersion(stream);
				Assert.Equal(new Version(LOG_VERSION), ver);
			}
		}

		[Theory]
		[InlineData("<installLog></installLog>")]
		public void ReadVersionDefaultTest(string input)
		{
			using (MemoryStream stream = InitStream(input)) {
				Version ver = InstallLog.ReadVersion(stream);
				Assert.Equal(new Version(0, 0, 0, 0), ver);
			}
		}

		[Theory]
		[InlineData("<installLog></installLog>")]
		[InlineData("<installLog fileVersion=\"" + LOG_VERSION + "\"></installLog>")]
		public void IsLogValidTest(string input)
		{
			using (MemoryStream stream = InitStream(input)) {
				Assert.True(InstallLog.IsLogValid(stream));
			}
		}

		[Theory]
		[InlineData("")]
		[InlineData("<installLog>")]
		public void IsLogValidFalseTest(string input)
		{
			using (MemoryStream stream = InitStream(input)) {
				Assert.False(InstallLog.IsLogValid(stream));
			}
		}

		[Fact]
		public void GetXMLIniListEmptyTest()
		{
			string input = "<installLog fileVersion=\"" + LOG_VERSION + "\"></installLog>";
			IModRegistry registry = Substitute.For<IModRegistry>();
			IGameMode gameMode = Substitute.For<IGameMode>();

			using (MemoryStream stream = InitStream(input))
			{
				IInstallLog log = InstallLog.Initialize(registry, gameMode, INSTALL_PATH, stream);
				byte[] iniList = log.GetXMLIniList();
				Assert.Equal(""
					+ "<virtualModActivator fileVersion=\"1.0\">\r\n"
					+ "  <iniEdits />\r\n"
					+ "</virtualModActivator>",
					Encoding.UTF8.GetString(iniList));
			}
		}

		[Fact]
		public void GetXMLIniListTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				byte[] iniList = log.GetXMLIniList();
				Assert.Equal(""
					+ "<virtualModActivator fileVersion=\"1.0\">\r\n"
					+ "  <iniEdits>\r\n"
					+ "    <iniEdit modFile=\"basefile.zip\">\r\n"
					+ "      <iniFile>wootwoot.ini</iniFile>\r\n"
					+ "      <iniSection>somesec</iniSection>\r\n"
					+ "      <iniKey>somekey</iniKey>\r\n"
					+ "      <iniValue>somevalue</iniValue>\r\n"
					+ "    </iniEdit>\r\n"
					+ "  </iniEdits>\r\n"
					+ "</virtualModActivator>"
					, Encoding.UTF8.GetString(iniList));
			}
		}

		[Fact]
		public void GetXMLModListTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				byte[] modList = log.GetXMLModList();

				Assert.Equal(""
					+ "<virtualModActivator fileVersion=\"1.0\">\r\n"
					+ "  <modList>\r\n"
					+ "    <modInfo modId=\"\" modName=\"base\" modFileName=\"basefile.zip\" modFilePath=\"\">\r\n"
					+ "      <fileLink realPath=\"c:\\game\\data\\afile.xyz\" virtualPath=\"c:\\game\\data\\afile.xyz\">\r\n"
					+ "        <linkPriority>0</linkPriority>\r\n"
					+ "        <isActive>true</isActive>\r\n"
					+ "      </fileLink>\r\n"
					+ "    </modInfo>\r\n"
					+ "  </modList>\r\n"
					+ "</virtualModActivator>"
					, Encoding.UTF8.GetString(modList));
			}
		}

		[Fact]
		public void AddActiveModTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				IMod newMod = CreateMod("foo", "1.0");
				log.AddActiveMod(newMod);
				log.AddDataFile(newMod, "fooinstalled.txt");
				byte[] modList = log.GetXMLModList();
				Assert.Equal(""
					+ "<virtualModActivator fileVersion=\"1.0\">\r\n"
					+ "  <modList>\r\n"
					+ "    <modInfo modId=\"\" modName=\"base\" modFileName=\"basefile.zip\" modFilePath=\"\">\r\n"
					+ "      <fileLink realPath=\"c:\\game\\data\\afile.xyz\" virtualPath=\"c:\\game\\data\\afile.xyz\">\r\n"
					+ "        <linkPriority>0</linkPriority>\r\n"
					+ "        <isActive>true</isActive>\r\n"
					+ "      </fileLink>\r\n"
					+ "    </modInfo>\r\n"
					+ "    <modInfo modId=\"\" modName=\"foo\" modFileName=\"foofile.zip\" modFilePath=\"\">\r\n"
					+ "      <fileLink realPath=\"foofile\\fooinstalled.txt\" virtualPath=\"fooinstalled.txt\">\r\n"
					+ "        <linkPriority>0</linkPriority>\r\n"
					+ "        <isActive>true</isActive>\r\n"
					+ "      </fileLink>\r\n"
					+ "    </modInfo>\r\n"
					+ "  </modList>\r\n"
					+ "</virtualModActivator>"
					, Encoding.UTF8.GetString(modList));
			}
		}

		[Fact]
		public void ReplaceActiveModTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);

				IMod oldMod = CreateMod("foo", "1.0");
				log.AddActiveMod(oldMod);
				log.AddDataFile(oldMod, "fooinstalled.txt");

				IMod newMod = CreateMod("bar", "1.0");
				log.ReplaceActiveMod(oldMod, newMod);

				byte[] modList = log.GetXMLModList();
				Assert.Equal(""
					+ "<virtualModActivator fileVersion=\"1.0\">\r\n"
					+ "  <modList>\r\n"
					+ "    <modInfo modId=\"\" modName=\"base\" modFileName=\"basefile.zip\" modFilePath=\"\">\r\n"
					+ "      <fileLink realPath=\"c:\\game\\data\\afile.xyz\" virtualPath=\"c:\\game\\data\\afile.xyz\">\r\n"
					+ "        <linkPriority>0</linkPriority>\r\n"
					+ "        <isActive>true</isActive>\r\n"
					+ "      </fileLink>\r\n"
					+ "    </modInfo>\r\n"
					+ "    <modInfo modId=\"\" modName=\"bar\" modFileName=\"barfile.zip\" modFilePath=\"\">\r\n"
					+ "      <fileLink realPath=\"barfile\\fooinstalled.txt\" virtualPath=\"fooinstalled.txt\">\r\n"
					+ "        <linkPriority>0</linkPriority>\r\n"
					+ "        <isActive>true</isActive>\r\n"
					+ "      </fileLink>\r\n"
					+ "    </modInfo>\r\n"
					+ "  </modList>\r\n"
					+ "</virtualModActivator>"
					, Encoding.UTF8.GetString(modList));
			}
		}

		[Fact]
		public void GetModKeyTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);

				IMod newMod = CreateMod("foo", "1.0");
				log.AddActiveMod(newMod);

				Assert.False(String.IsNullOrEmpty(log.GetModKey(newMod)), "expect non-empty mod key");
			}
		}

		[Fact]
		public void GetMismatchedVersionModsTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);

				log.AddActiveMod(CreateMod("foo", "1.0"));

				IMod newMod = CreateMod("foo", "0.9");
				registry.GetMod(@"c:\base\foofile.zip").Returns(newMod);

				foreach (KeyValuePair<IMod, IMod> outdated in log.GetMismatchedVersionMods())
				{
					Assert.Equal("foo", outdated.Key.ModName);
					Assert.Equal("1.0", outdated.Key.HumanReadableVersion);
					Assert.Equal("0.9", outdated.Value.HumanReadableVersion);
				}
			}
		}

		[Fact]
		public void RemoveModTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				log.RemoveMod(log.ActiveMods[0]);
				Assert.Equal(0, log.ActiveMods.Count);
				byte[] modList = log.GetXMLModList();
				string serialized = Encoding.UTF8.GetString(log.GetXMLModList());
				Assert.Equal(""
					+ "<virtualModActivator fileVersion=\"1.0\">\r\n"
					+ "  <modList />\r\n"
					+ "</virtualModActivator>", serialized);
			}
		}

		[Fact]
		public void RemoveDataFileTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				log.RemoveDataFile(log.ActiveMods[0], @"c:\game\data\afile.xyz");
				// removing the (only) data file does not remove the mod from active mods...
				Assert.Equal(1, log.ActiveMods.Count);
				// ... but the mod doesn't appear in the serialized mod list
				byte[] modList = log.GetXMLModList();
				Assert.Equal(""
					+ "<virtualModActivator fileVersion=\"1.0\">\r\n"
					+ "  <modList />\r\n"
					+ "</virtualModActivator>", Encoding.UTF8.GetString(log.GetXMLModList()));
			} }

		[Fact]
		public void GetCurrentFileOwnerTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				IMod mod = log.GetCurrentFileOwner(@"c:\game\data\afile.xyz");
				IMod nullMod = log.GetCurrentFileOwner(@"c:\missing_file.txt");
				Assert.Equal("base", mod.ModName);
				Assert.Null(nullMod);
			}
		}

		[Fact]
		public void GetPreviousFileOwnerTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				IMod newMod = CreateMod("foo", "1.0");
				log.AddActiveMod(newMod);

				IMod prev = log.GetPreviousFileOwner(@"c:\game\data\afile.xyz");

				log.AddDataFile(newMod, @"c:\game\data\afile.xyz");

				IMod owner = log.GetPreviousFileOwner(@"c:\game\data\afile.xyz");
				IMod nullMod = log.GetPreviousFileOwner(@"c:\missing_file.txt");

				Assert.Equal("base", owner.ModName);
				// mod had only one owner before adding the file to foo
				Assert.Null(prev);
				// missing file has no current or previous owner
				Assert.Null(nullMod);
			}
		}

		[Fact]
		public void GetCurrentFileOwnerKeyTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				Assert.Equal("abc", log.GetCurrentFileOwnerKey(@"c:\game\data\afile.xyz"));
				Assert.Null(log.GetCurrentFileOwnerKey(@"c:\missing_file.txt"));
			}
		}

		[Fact()]
		public void GetPreviousFileOwnerKeyTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				IMod newMod = CreateMod("foo", "1.0");
				log.AddActiveMod(newMod);

				string prev = log.GetPreviousFileOwnerKey(@"c:\game\data\afile.xyz");

				log.AddDataFile(newMod, @"c:\game\data\afile.xyz");

				string owner = log.GetPreviousFileOwnerKey(@"c:\game\data\afile.xyz");
				string nullMod = log.GetPreviousFileOwnerKey(@"c:\missing_file.txt");

				Assert.Equal("abc", owner);
				// mod had only one owner before adding the file to foo
				Assert.Null(prev);
				// missing file has no current or previous owner
				Assert.Null(nullMod);
			}
		}

		[Fact]
		public void LogOriginalDataFileTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				log.LogOriginalDataFile(@"c:\origfile.txt");
				Assert.Equal("orig", log.GetCurrentFileOwnerKey(@"c:\origfile.txt"));

				// can also override ownership
				log.LogOriginalDataFile(@"c:\game\data\afile.xyz");
				Assert.Equal("orig", log.GetCurrentFileOwnerKey(@"c:\game\data\afile.xyz"));

			}
		}

		[Fact()]
		public void GetInstalledModFilesTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				IMod mod = log.ActiveMods[0];
				IList<string> files = log.GetInstalledModFiles(mod);
				Assert.Equal(1, files.Count);
				Assert.Equal(@"c:\game\data\afile.xyz", files[0]);
			}
		}

		[Fact]
		public void GetFileInstallersTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				IList<IMod> mods = log.GetFileInstallers(@"c:\game\data\afile.xyz");
				Assert.Equal(mods, log.ActiveMods.ToList());

				IMod newMod = CreateMod("foo", "1.0");
				log.AddActiveMod(newMod);
				log.AddDataFile(newMod, @"c:\game\data\afile.xyz");
				mods = log.GetFileInstallers(@"c:\game\data\afile.xyz");
				Assert.Equal(mods, log.ActiveMods.ToList());
			}
		}

		[Fact]
		public void AddIniEditTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);

				log.AddIniEdit(log.ActiveMods[0], "sample.ini", "section", "key", "value");

				string iniList = Encoding.UTF8.GetString(log.GetXMLIniList());

				string expected = ""
					+ "<virtualModActivator fileVersion=\"1.0\">\r\n"
					+ "  <iniEdits>\r\n"
					+ "    <iniEdit modFile=\"basefile.zip\">\r\n"
					+ "      <iniFile>wootwoot.ini</iniFile>\r\n"
					+ "      <iniSection>somesec</iniSection>\r\n"
					+ "      <iniKey>somekey</iniKey>\r\n"
					+ "      <iniValue>somevalue</iniValue>\r\n"
					+ "    </iniEdit>\r\n"
					+ "    <iniEdit modFile=\"basefile.zip\">\r\n"
					+ "      <iniFile>sample.ini</iniFile>\r\n"
					+ "      <iniSection>section</iniSection>\r\n"
					+ "      <iniKey>key</iniKey>\r\n"
					+ "      <iniValue>value</iniValue>\r\n"
					+ "    </iniEdit>\r\n"
					+ "  </iniEdits>\r\n"
					+ "</virtualModActivator>";

				Assert.Equal(expected, iniList);

			}
		}

		[Fact]
		public void ReplaceIniEditMissingTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				Assert.Throws<NullReferenceException>(
					() => log.ReplaceIniEdit(log.ActiveMods[0], "missing.ini", "somesec", "somekey", "value"));
			}
		}


		[Fact]
		public void ReplaceIniEditTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);

				log.ReplaceIniEdit(log.ActiveMods[0], "wootwoot.ini", "somesec", "somekey", "newval");

				string iniList = Encoding.UTF8.GetString(log.GetXMLIniList());

				string expected = ""
					+ "<virtualModActivator fileVersion=\"1.0\">\r\n"
					+ "  <iniEdits>\r\n"
					+ "    <iniEdit modFile=\"basefile.zip\">\r\n"
					+ "      <iniFile>wootwoot.ini</iniFile>\r\n"
					+ "      <iniSection>somesec</iniSection>\r\n"
					+ "      <iniKey>somekey</iniKey>\r\n"
					+ "      <iniValue>newval</iniValue>\r\n"
					+ "    </iniEdit>\r\n"
					+ "  </iniEdits>\r\n"
					+ "</virtualModActivator>";

				Assert.Equal(expected, iniList);

			}
		}

		[Fact]
		public void RemoveIniEditTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);

				log.RemoveIniEdit(log.ActiveMods[0], "wootwoot.ini", "somesec", "somekey");
				string iniList = Encoding.UTF8.GetString(log.GetXMLIniList());

				string expected = ""
					+ "<virtualModActivator fileVersion=\"1.0\">\r\n"
					+ "  <iniEdits />\r\n"
					+ "</virtualModActivator>";

				Assert.Equal(expected, iniList);


			}
		}

		[Fact]
		public void GetCurrentIniEditOwnerTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);

				Assert.Equal(log.ActiveMods[0], log.GetCurrentIniEditOwner("wootwoot.ini", "somesec", "somekey"));
				Assert.Equal(null, log.GetCurrentIniEditOwner("missing.ini", "somesec", "somekey"));
			}
		}

		[Fact]
		public void GetCurrentIniEditOwnerKeyTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);

				Assert.Equal("abc", log.GetCurrentIniEditOwnerKey("wootwoot.ini", "somesec", "somekey"));
				Assert.Equal(null, log.GetCurrentIniEditOwnerKey("missing.ini", "somesec", "somekey"));
			}
		}

		[Fact]
		public void GetPreviousIniValueTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);

				IMod newMod = CreateMod("foo", "1.0");
				log.AddActiveMod(newMod);

				log.AddIniEdit(newMod, "wootwoot.ini", "somesec", "somekey", "newval");

				Assert.Equal("somevalue", log.GetPreviousIniValue("wootwoot.ini", "somesec", "somekey"));
			}
		}

		[Fact]
		public void LogOriginalIniValueTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);

				log.LogOriginalIniValue("wootwoot.ini", "somesec", "newkey", "origvalue");
				log.AddIniEdit(log.ActiveMods[0], "wootwoot.ini", "somesec", "newkey", "newvalue");

				Assert.Equal("origvalue", log.GetPreviousIniValue("wootwoot.ini", "somesec", "newkey"));
			}
		}

		[Fact]
		public void GetInstalledIniEditsTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);

				IMod newMod = CreateMod("foo", "1.0");
				log.AddActiveMod(newMod);

				IList<IniEdit> edits = log.GetInstalledIniEdits(log.ActiveMods[0]);
				Assert.Equal(1, edits.Count);
				Assert.Equal(new IniEdit("wootwoot.ini", "somesec", "somekey"), edits[0]);

				edits = log.GetInstalledIniEdits(newMod);
				Assert.Equal(0, edits.Count);
			}
		}

		[Fact]
		public void GetIniEditInstallersTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				IList<IMod> installers = log.GetIniEditInstallers("wootwoot.ini", "somesec", "somekey");

				Assert.Equal(1, installers.Count);
				Assert.Equal("base", installers[0].ModName);
			}
		}

		[Fact]
		public void AddGameSpecificValueEditTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				log.AddGameSpecificValueEdit(log.ActiveMods[0], "newkey", Encoding.ASCII.GetBytes("value"));

				Assert.Equal(new Set<string>() { "editKey", "newkey" }, log.GetInstalledGameSpecificValueEdits(log.ActiveMods[0]));
			}
		}

		[Fact]
		public void ReplaceGameSpecificValueEditTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				log.ReplaceGameSpecificValueEdit(log.ActiveMods[0], "editKey", Encoding.ASCII.GetBytes("foobar"));

				Assert.True(false, "well, umm, since there is no getter for the current game specific value, "
					+ "what is the observable result of a Replace?");
			}
		}

		[Fact]
		public void RemoveGameSpecificValueEditTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				log.RemoveGameSpecificValueEdit(log.ActiveMods[0], "editKey");

				Assert.Null(log.GetCurrentGameSpecificValueEditOwner("editKey"));
			}
		}

		[Fact]
		public void GetCurrentGameSpecificValueEditOwnerTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				Assert.Equal("base", log.GetCurrentGameSpecificValueEditOwner("editKey").ModName);
			}
		}

		[Fact]
		public void GetCurrentGameSpecificValueEditOwnerKeyTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				Assert.Equal("abc", log.GetCurrentGameSpecificValueEditOwnerKey("editKey"));
			}
		}

		[Fact]
		public void GetPreviousGameSpecificValueTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				IMod mod = CreateMod("foo", "1.0");
				log.AddActiveMod(mod);

				log.AddGameSpecificValueEdit(mod, "editKey", Encoding.ASCII.GetBytes("changed"));

				Assert.Equal(Encoding.ASCII.GetBytes("value"), log.GetPreviousGameSpecificValue("editKey"));
			}
		}

		[Fact]
		public void LogOriginalGameSpecificValueTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);

				byte[] value = Encoding.ASCII.GetBytes("origvalue");

				log.LogOriginalGameSpecificValue("editKey", value);
				Assert.Equal(value, log.GetPreviousGameSpecificValue("editKey"));
			}
		}

		[Fact]
		public void GetInstalledGameSpecificValueEditsTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				Assert.Equal(new Set<string>() { "editKey" }, log.GetInstalledGameSpecificValueEdits(log.ActiveMods[0]));
			}
		}

		[Fact]
		public void GetGameSpecificValueEditInstallersTest()
		{
			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = CreateInstallLog(stream);
				Assert.Equal(log.ActiveMods, log.GetGameSpecificValueEditInstallers("editKey").ToList());
			}
		}

		[Fact]
		public void ReleaseTest()
		{
			IModRegistry registry = Substitute.For<IModRegistry>();
			IGameMode gameMode = Substitute.For<IGameMode>();

			using (MemoryStream stream = InitStream(SAMPLE_INI))
			{
				IInstallLog log = InstallLog.Initialize(registry, gameMode, INSTALL_PATH, stream);
				InstallLog.Release();
				
				stream.Seek(0, SeekOrigin.Begin);
				log = InstallLog.Initialize(registry, gameMode, INSTALL_PATH, stream);
			}
		}

	}
}