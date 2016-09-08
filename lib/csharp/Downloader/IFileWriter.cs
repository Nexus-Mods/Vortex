using System;

namespace Downloader
{
	public interface IFileWriter : IDisposable
	{
		ulong WrittenByteCount { get; }

		event EventHandler UnableToWrite;

		void Close();
		void EnqueueBlock(ulong p_intStartPosition, byte[] p_bteData);
	}
}