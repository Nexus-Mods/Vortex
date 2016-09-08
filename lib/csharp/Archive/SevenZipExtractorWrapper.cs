using SevenZip;
using System;
using System.Collections.ObjectModel;
using System.IO;

namespace Archiving
{
	class SevenZipExtractorWrapper : IExtractor
	{
		private SevenZipExtractor m_szeWrappee;

		public SevenZipExtractorWrapper(Stream p_stmFile)
		{
			this.m_szeWrappee = new SevenZipExtractor(p_stmFile);

			m_szeWrappee.Extracting += Extracting;
			m_szeWrappee.ExtractionFinished += ExtractionFinished;
			m_szeWrappee.FileExists += FileExists;
			m_szeWrappee.FileExtractionFinished += FileExtractionFinished;
			m_szeWrappee.FileExtractionStarted += FileExtractionStarted;
		}

		public SevenZipExtractorWrapper(string p_strPath)
		{
			this.m_szeWrappee = new SevenZipExtractor(p_strPath);
		}

		public ReadOnlyCollection<ArchiveFileInfo> ArchiveFileData
		{
			get
			{
				return m_szeWrappee.ArchiveFileData;
			}
		}

		public ReadOnlyCollection<string> ArchiveFileNames
		{
			get
			{
				return m_szeWrappee.ArchiveFileNames;
			}
		}

		public ReadOnlyCollection<ArchiveProperty> ArchiveProperties
		{
			get
			{
				return m_szeWrappee.ArchiveProperties;
			}
		}

		public string FileName
		{
			get
			{
				return m_szeWrappee.FileName;
			}
		}

		public uint FilesCount
		{
			get
			{
				return m_szeWrappee.FilesCount;
			}
		}

		public InArchiveFormat Format
		{
			get
			{
				return m_szeWrappee.Format;
			}
		}

		public bool IsSolid
		{
			get
			{
				return m_szeWrappee.IsSolid;
			}
		}

		public long PackedSize
		{
			get
			{
				return m_szeWrappee.PackedSize;
			}
		}

		public bool PreserveDirectoryStructure
		{
			get
			{
				return m_szeWrappee.PreserveDirectoryStructure;
			}

			set
			{
				m_szeWrappee.PreserveDirectoryStructure = value;
			}
		}

		public long UnpackedSize
		{
			get
			{
				return m_szeWrappee.UnpackedSize;
			}
		}

		public ReadOnlyCollection<string> VolumeFileNames
		{
			get
			{
				return m_szeWrappee.VolumeFileNames;
			}
		}

		public event EventHandler<ProgressEventArgs> Extracting;
		public event EventHandler<EventArgs> ExtractionFinished;
		public event EventHandler<FileOverwriteEventArgs> FileExists;
		public event EventHandler<FileInfoEventArgs> FileExtractionFinished;
		public event EventHandler<FileInfoEventArgs> FileExtractionStarted;

		public void BeginExtractArchive(string directory)
		{
			m_szeWrappee.BeginExtractArchive(directory);
		}

		public void BeginExtractFile(int index, Stream stream)
		{
			m_szeWrappee.BeginExtractFile(index, stream);
		}

		public void BeginExtractFile(string fileName, Stream stream)
		{
			m_szeWrappee.BeginExtractFile(fileName, stream);
		}

		public void BeginExtractFiles(ExtractFileCallback extractFileCallback)
		{
			BeginExtractFiles(extractFileCallback);
		}

		public void BeginExtractFiles(string directory, params int[] indexes)
		{
			BeginExtractFiles(directory, indexes);
		}

		public void BeginExtractFiles(string directory, params string[] fileNames)
		{
			BeginExtractFiles(directory, fileNames);
		}

		public bool Check()
		{
			return m_szeWrappee.Check();
		}

		public void Dispose()
		{
			m_szeWrappee.Dispose();
		}

		public void ExtractArchive(string directory)
		{
			m_szeWrappee.ExtractArchive(directory);
		}

		public void ExtractFile(string fileName, Stream stream)
		{
			m_szeWrappee.ExtractFile(fileName, stream);
		}

		public void ExtractFile(int index, Stream stream)
		{
			m_szeWrappee.ExtractFile(index, stream);
		}

		public void ExtractFiles(ExtractFileCallback extractFileCallback)
		{
			m_szeWrappee.ExtractFiles(extractFileCallback);
		}

		public void ExtractFiles(string directory, params string[] fileNames)
		{
			m_szeWrappee.ExtractFiles(directory, fileNames);
		}

		public void ExtractFiles(string directory, params int[] indexes)
		{
			m_szeWrappee.ExtractFiles(directory, indexes);
		}
	}
}
