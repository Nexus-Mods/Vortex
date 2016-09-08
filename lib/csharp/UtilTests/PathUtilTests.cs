using System;
using System.Linq;
using Xunit;

namespace Util.Tests
{
	public class PathUtilTests
	{
		[Theory]
		[InlineData(@"c:")]
		[InlineData(@"c:\")]
		[InlineData(@"C:\")]
		[InlineData(@"\\?\c:")]
		public void IsDrivePathRecognizesDrives(string val)
		{
			Assert.True(PathUtil.IsDrivePath(val));
		}

		[Theory]
		[InlineData(@"c:\windows")]
		public void IsDrivePathRejectsNonDrives(string val)
		{
			Assert.False(PathUtil.IsDrivePath(val));
		}

		[Theory]
		[InlineData(@"c:""")]
		[InlineData(@"c:\*")]
		[InlineData(@"c:\<")]
		[InlineData(@"c:\>")]
		[InlineData(@"c:\|")]
		[InlineData(@"c:\?")]
		[InlineData(@"c:\:")]
		public void ContainsInvalidPathCharsRecognizesInvalid(string val)
		{
			Assert.True(PathUtil.ContainsInvalidPathChars(val));
		}

		[Theory]
		[InlineData(@"c:\windows")]
		public void ContainsInvalidPathCharsRecognizesValid(string val)
		{
			Assert.False(PathUtil.ContainsInvalidPathChars(val));
		}

		[Theory]
		[InlineData(@"C:\windows\system32")]
		[InlineData(@"C:/windows/system32")]
		[InlineData(@"C:\windows/system32")]
		public void IsValidPathTestValid(string val)
		{
			Assert.True(PathUtil.IsValidPath(val));
		}

		[Theory]
		[InlineData(@"")]      // no empty string
		[InlineData(@"c:\*")]  // no path with invalid characters (tested in ContainsInvalidPathCharsTest)
		public void IsValidPathTestInvalid(string val)
		{
			Assert.False(PathUtil.IsValidPath(val));
		}

		[Fact]
		public void IsValidPathTestLength()
		{
			// no more than 260 characters unless prefixed with \\?\
			Assert.False(PathUtil.IsValidPath("C:" + String.Concat(Enumerable.Repeat(@"\test", 100))));
			// TODO the function currently does not recognize extended unicode strings
			// Assert.True(PathUtil.IsValidPath(@"\\?\C:" + String.Concat(Enumerable.Repeat(@"\test", 100))));
		}

		[Theory]
		[InlineData(@"c:\*x?y""z", @"c:\xyz")]
		public void StripInvalidPathCharsTest(string path, string expected)
		{
			Assert.StrictEqual(expected, PathUtil.StripInvalidPathChars(path));
		}

		[Theory]
		[InlineData(@"c:\windows", @"c:\windows\system\stuff", @"system\stuff")]
		[InlineData(@"c:\windows", @"c:\temp", @"..\temp")]
		public void RelativizePathTest(string basePath, string testPath, string expected)
		{
			Assert.StrictEqual(expected, PathUtil.RelativizePath(basePath, testPath));
		}

		[Theory]
		[InlineData(@"c://windows/..\\temp", @"c:\windows\..\temp")] // duplicate path separators are removed and normalized to backslash
																	 // but .. is not resolved
		public void NormalizePathTest(string input, string expected)
		{
			Assert.StrictEqual(expected, PathUtil.NormalizePath(input));
		}

		[Theory]
		[InlineData("some*filename", "some_filename")]
		public void SanitizeFilenameTest(string input, string expected)
		{
			Assert.StrictEqual(expected, PathUtil.SanitizeFilename(input));
		}
	}
}