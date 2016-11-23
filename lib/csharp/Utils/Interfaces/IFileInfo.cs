using System.IO;

namespace Utils
{
	public interface IFileInfo
	{
		FileAttributes Attributes { get; }
		bool IsReadOnly { get; }
	}
}
