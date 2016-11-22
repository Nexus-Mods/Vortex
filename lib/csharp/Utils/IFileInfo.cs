using System.IO;

namespace Util
{
	public interface IFileInfo
	{
		FileAttributes Attributes { get; }
		bool IsReadOnly { get; }
	}
}
