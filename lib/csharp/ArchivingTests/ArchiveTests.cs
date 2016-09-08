using NSubstitute;
using NSubstitute.Core;
using SevenZip;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Text;
using Util;
using Xunit;

namespace Archiving.Tests
{
	public class ArchiveTests
	{
		const string TEMP_PATH = @"c:\temp";
		const string ARCHIVE_PATH = @"c:\archive.zip";

		IFileSystem fs;
		IExtractorFactory factory;
		IExtractor extractor;

		public ArchiveTests()
		{
			fs = Substitute.For<IFileSystem>();
			fs.CreateTempDirectory().Returns(TEMP_PATH);
			fs.Exists("").ReturnsForAnyArgs(false);

			factory = Substitute.For<IExtractorFactory>();

			List<ArchiveFileInfo> files = new List<ArchiveFileInfo>();
			ArchiveFileInfo someFile = new ArchiveFileInfo();
			someFile.FileName = "somefile.txt";
			someFile.IsDirectory = false;
			someFile.Index = 0;
			someFile.Size = 12;
			files.Add(someFile);
			ArchiveFileInfo anotherFile = new ArchiveFileInfo();
			anotherFile.FileName = @"somedir\anotherfile.txt";
			anotherFile.IsDirectory = false;
			anotherFile.Index = 1;
			files.Add(anotherFile);
			extractor = Substitute.For<IExtractor>();
			extractor.ArchiveFileData.Returns(new ReadOnlyCollection<ArchiveFileInfo>(files));
			extractor.ExtractFile(0, Arg.Do<Stream>((str) => { str.Write(Encoding.ASCII.GetBytes("Hello World!"), 0, 12); }));

			factory.GetThreadSafeExtractor(ARCHIVE_PATH).Returns(extractor);
			factory.GetExtractor(ARCHIVE_PATH).Returns(extractor).AndDoes((CallInfo call) => {
				Debugger.Log(1, "category", "get extractor\n");
			});
		}

		[Fact]
		public void IsArchiveTestRejectsMissing()
		{
			Assert.False(Archive.IsArchive(fs, factory, ARCHIVE_PATH));
		}

		[Fact]
		public void IsArchiveTestAcceptsMissingWithPrefix()
		{
			Assert.True(Archive.IsArchive(fs, factory, @"arch:" + ARCHIVE_PATH));
		}

		[Fact]
		public void IsArchiveTestRejectsOnAccessError()
		{
			fs.Exists(ARCHIVE_PATH).ReturnsForAnyArgs(true);
			IExtractor extractor = Substitute.For<IExtractor>();
			extractor.FilesCount.Returns((uint)0).AndDoes((CallInfo info) => {
				throw new InvalidOperationException("");
			});

			factory.GetExtractor(ARCHIVE_PATH).Returns(extractor);

			Assert.False(Archive.IsArchive(fs, factory, ARCHIVE_PATH));
		}

		[Fact]
		public void IsArchivePathTest()
		{
			Assert.True(Archive.IsArchivePath(@"arch:" + ARCHIVE_PATH + "//somethingorother"));
			Assert.False(Archive.IsArchivePath(""));
			Assert.False(Archive.IsArchivePath(ARCHIVE_PATH));
		}

		[Fact]
		public void ParseArchivePathTest()
		{
			Assert.Equal(new KeyValuePair<string, string>(null, null), Archive.ParseArchivePath(ARCHIVE_PATH));
			Assert.Equal(new KeyValuePair<string, string>(ARCHIVE_PATH, "somefile.txt"),
						 Archive.ParseArchivePath(@"arch:" + ARCHIVE_PATH + "//somefile.txt"));

			// name fo the file inside the archive has to be separated by a double-forward slash
			Assert.Throws<ArgumentOutOfRangeException>(() => Archive.ParseArchivePath(@"arch:" + ARCHIVE_PATH + "/somefile.txt"));
		}

		[Fact]
		public void GenerateArchivePathTest()
		{
			string path = Archive.GenerateArchivePath(ARCHIVE_PATH, @"somefile.txt");
			Assert.Equal(@"arch:" + ARCHIVE_PATH + "//somefile.txt", path);
		}

		[Fact]
		public void BeginReadOnlyTransactionTest()
		{
			extractor.IsSolid.Returns(false);

			Archive arch = new Archive(fs, factory, ARCHIVE_PATH);
			arch.BeginReadOnlyTransaction();

			factory.Received(1).GetThreadSafeExtractor(ARCHIVE_PATH);
		}

		[Fact]
		public void BeginReadOnlyTransactionTestSolid()
		{
			extractor.IsSolid.Returns(true);

			Archive arch = new Archive(fs, factory, ARCHIVE_PATH);

			// don't count call from the constructor (currently 2 calls to GetExtractor)
			factory.ClearReceivedCalls();

			arch.BeginReadOnlyTransaction();

			factory.Received(1).GetThreadSafeExtractor(ARCHIVE_PATH);
			factory.Received(1).GetExtractor(ARCHIVE_PATH);
		}

		[Fact]
		public void EndReadOnlyTransactionTest()
		{
			extractor.IsSolid.Returns(true);

			Archive arch = new Archive(fs, factory, ARCHIVE_PATH);
			arch.BeginReadOnlyTransaction();

			arch.EndReadOnlyTransaction();
			// Begin-/EndReadOnlyTransaction have practically no observable behaviour we could
			// test, except that in solid mode the archive has to be extracted to a temporary
			// location to allow reasonably fast file access. That temp location should be
			// deleted when the transaction ends.
			fs.Received(1).ForceDelete(TEMP_PATH);
		}

		[Fact]
		public void IsDirectoryTest()
		{
			Archive arch = new Archive(fs, factory, ARCHIVE_PATH);
			Assert.True(arch.IsDirectory("somedir"));
			Assert.False(arch.IsDirectory("somefile.txt"));
			Assert.False(arch.IsDirectory("missingfile.txt"));
		}

		[Fact]
		public void GetDirectoriesTest()
		{
			Archive arch = new Archive(fs, factory, ARCHIVE_PATH);

			Assert.Equal(new string[] { "somedir" }, arch.GetDirectories(""));
		}

		[Fact]
		public void GetFilesTest()
		{
			Archive arch = new Archive(fs, factory, ARCHIVE_PATH);

			Assert.Equal(new string[] { "somefile.txt" }, arch.GetFiles("", false));
			Assert.Equal(new string[] { "somefile.txt", @"somedir\anotherfile.txt" }, arch.GetFiles("", true));
			Assert.Equal(new string[] { "somefile.txt" }, arch.GetFiles("", "*.txt", false));
			Assert.Equal(new string[] { }, arch.GetFiles(".", "*.xml", false));
			Assert.Equal(new string[] { }, arch.GetFiles("subdir", false));
		}

		[Fact]
		public void ContainsFileTest()
		{
			Archive arch = new Archive(fs, factory, ARCHIVE_PATH);

			Assert.True(arch.ContainsFile("somefile.txt"));
			Assert.False(arch.ContainsFile("missingfile.txt"));
		}

		[Fact]
		public void GetFileContentsTest()
		{
			Archive arch = new Archive(fs, factory, ARCHIVE_PATH);
			Assert.Equal(Encoding.ASCII.GetBytes("Hello World!"), arch.GetFileContents("somefile.txt"));
		}

		[Fact()]
		public void ReplaceFileTest()
		{
			ICompressor compressor = Substitute.For<ICompressor>();
			factory.GetCompressor().Returns(compressor);

			Archive arch = new Archive(fs, factory, ARCHIVE_PATH);

			bool changed = true;
			arch.FilesChanged += (object sender, EventArgs args) => { changed = true; };

			arch.ReplaceFile("somefile.txt", "foobar");

			Assert.True(changed);
			compressor.Received().ModifyArchive(ARCHIVE_PATH, Arg.Any<Dictionary<int, string>>());
			compressor.Received().CompressStreamDictionary(Arg.Any<Dictionary<string, Stream>>(), ARCHIVE_PATH);
		}

		[Fact]
		public void DeleteFileTest()
		{
			ICompressor compressor = Substitute.For<ICompressor>();
			factory.GetCompressor().Returns(compressor);

			Archive arch = new Archive(fs, factory, ARCHIVE_PATH);

			bool changed = false;
			arch.FilesChanged += (object sender, EventArgs args) => { changed = true; };

			arch.DeleteFile("somefile.txt");
			Assert.True(changed);
			compressor.Received().ModifyArchive(ARCHIVE_PATH, Arg.Any<Dictionary<int, string>>());
		}
	}
}