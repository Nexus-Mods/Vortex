using SevenZip;
using System.Collections.Generic;
using System.IO;

namespace Archiving
{
	public interface ICompressor
	{
		OutArchiveFormat ArchiveFormat { get; set; }
		CompressionMode CompressionMode { get; set; }

		void ModifyArchive(string m_strPath, Dictionary<int, string> dicDelete);
		void CompressStreamDictionary(Dictionary<string, Stream> dictionary, string m_strPath);
	}
}
