using SevenZip;
using System;
using System.Collections.ObjectModel;
using System.IO;

namespace Archiving
{
	public interface IExtractor: IDisposable
	{
		ReadOnlyCollection<ArchiveFileInfo> ArchiveFileData { get; }
		ReadOnlyCollection<string> ArchiveFileNames { get; }
		ReadOnlyCollection<ArchiveProperty> ArchiveProperties { get; }
		string FileName { get; }
		uint FilesCount { get; }
		InArchiveFormat Format { get; }
		bool IsSolid { get; }
		long PackedSize { get; }
		bool PreserveDirectoryStructure { get; set; }
		long UnpackedSize { get; }
		ReadOnlyCollection<string> VolumeFileNames { get; }

		event EventHandler<ProgressEventArgs> Extracting;
		event EventHandler<EventArgs> ExtractionFinished;
		event EventHandler<FileOverwriteEventArgs> FileExists;
		event EventHandler<FileInfoEventArgs> FileExtractionFinished;
		event EventHandler<FileInfoEventArgs> FileExtractionStarted;

		void BeginExtractArchive(string directory);
		void BeginExtractFile(string fileName, Stream stream);
		void BeginExtractFile(int index, Stream stream);
		void BeginExtractFiles(ExtractFileCallback extractFileCallback);
		void BeginExtractFiles(string directory, params string[] fileNames);
		void BeginExtractFiles(string directory, params int[] indexes);
		bool Check();
		void ExtractArchive(string directory);
		void ExtractFile(int index, Stream stream);
		void ExtractFile(string fileName, Stream stream);
		void ExtractFiles(ExtractFileCallback extractFileCallback);
		void ExtractFiles(string directory, params int[] indexes);
		void ExtractFiles(string directory, params string[] fileNames);
	}
}
