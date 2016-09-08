using NSubstitute;
using System.Collections.Generic;
using Util;
using Xunit;

namespace IniEditing.Tests
{
	public class IniMethodsTests
	{
		const string INI_PATH = @"c:\settings.ini";
		const string SECTION = "section";

		List<string> fakeIni;
		IniMethods ini = null;

		public IniMethodsTests()
		{
			fakeIni = new List<string> {
			"[" + SECTION + "]",
			"str = strval",
			"int = 42"
			};


			IFileSystem fs = Substitute.For<IFileSystem>();
			fs.ReadAllLines(INI_PATH).Returns((args) => fakeIni.ToArray());
			fs
				.When((obj) => obj.WriteAllLines(INI_PATH, Arg.Any<string[]>()))
				.Do((args) =>
				{
					fakeIni = new List<string>((string[])args[1]);
				});
			fs
				.When((obj) => obj.AppendAllText(INI_PATH, Arg.Any<string>()))
				.Do((args) =>
				{
					fakeIni.Add((string)args[1]);
				});

			ini = new IniMethods(fs);
		}


		[Fact]
		public void GetPrivateProfileStringTest()
		{
			Assert.Equal("strval", ini.GetPrivateProfileString(SECTION, "str", "narf", INI_PATH));
			Assert.Equal("narf", ini.GetPrivateProfileString(SECTION, "missing", "narf", INI_PATH));
			Assert.Equal("narf", ini.GetPrivateProfileString("wrong_section", "missing", "narf", INI_PATH));
			Assert.Equal("narf", ini.GetPrivateProfileString(SECTION, "missing", "narf", "wrongfile.ini"));
		}

		[Fact]
		public void GetPrivateProfileInt32Test()
		{
			Assert.Equal(42, ini.GetPrivateProfileInt32(SECTION, "int", 13, INI_PATH));
			Assert.Equal(13, ini.GetPrivateProfileInt32(SECTION, "missing", 13, INI_PATH));
			Assert.Equal(13, ini.GetPrivateProfileInt32("wrong_section", "missing", 13, INI_PATH));
			Assert.Equal(13, ini.GetPrivateProfileInt32(SECTION, "missing", 13, "wrongfile.ini"));
		}

		[Fact]
		public void GetPrivateProfileUInt64Test()
		{
			Assert.Equal(42u, ini.GetPrivateProfileUInt64(SECTION, "int", 13u, INI_PATH));
			Assert.Equal(13u, ini.GetPrivateProfileUInt64(SECTION, "missing", 13u, INI_PATH));
			Assert.Equal(13u, ini.GetPrivateProfileUInt64("wrong_section", "missing", 13u, INI_PATH));
			Assert.Equal(13u, ini.GetPrivateProfileUInt64(SECTION, "missing", 13u, "wrongfile.ini"));
		}

		[Fact]
		public void WritePrivateProfileStringTest()
		{
			ini.WritePrivateProfileString(SECTION, "new", "foobar", INI_PATH);
			ini.WritePrivateProfileString(SECTION, "int", "brainz", INI_PATH);
			ini.WritePrivateProfileString(SECTION, "str", "narf", INI_PATH);
			Assert.Contains("new = foobar", fakeIni);
			Assert.Contains("str = narf", fakeIni);
			Assert.Contains("int = brainz", fakeIni);
			Assert.DoesNotContain("str = strval", fakeIni);
			Assert.DoesNotContain("int = 42", fakeIni);
		}

		[Fact]
		public void WritePrivateProfileInt32Test()
		{
			ini.WritePrivateProfileInt32(SECTION, "new", 7, INI_PATH);
			ini.WritePrivateProfileInt32(SECTION, "int", 13, INI_PATH);
			ini.WritePrivateProfileInt32(SECTION, "str", 4711, INI_PATH);

			Assert.Contains("new = 7", fakeIni);
			Assert.Contains("int = 13", fakeIni);
			Assert.Contains("str = 4711", fakeIni);
			Assert.DoesNotContain("int = 42", fakeIni);
			Assert.DoesNotContain("str = strval", fakeIni);
		}
	}
}