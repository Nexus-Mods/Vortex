using SevenZip;
using System.Collections.Generic;
using System.IO;

namespace Archiving
{
	internal class SevenZipCompressorWrapper : ICompressor
	{
		private SevenZipCompressor m_szcWrappee = null;

		public SevenZipCompressorWrapper()
		{
			m_szcWrappee = new SevenZipCompressor();
		}

		public OutArchiveFormat ArchiveFormat
		{
			get
			{
				return m_szcWrappee.ArchiveFormat;
			}

			set
			{
				m_szcWrappee.ArchiveFormat = value;
			}
		}

		public CompressionMode CompressionMode
		{
			get
			{
				return m_szcWrappee.CompressionMode;
			}

			set
			{
				m_szcWrappee.CompressionMode = value;
			}
		}

		public void CompressStreamDictionary(Dictionary<string, Stream> streamDictionary, string archiveName)
		{
			m_szcWrappee.CompressStreamDictionary(streamDictionary, archiveName);
		}

		public void ModifyArchive(string archiveName, Dictionary<int, string> newFileNames)
		{
			m_szcWrappee.ModifyArchive(archiveName, newFileNames);
		}
	}
}