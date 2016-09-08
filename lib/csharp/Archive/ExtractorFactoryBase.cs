using System.Collections.Generic;
using System.IO;

namespace Archiving
{
	public abstract class ExtractorFactoryBase : IExtractorFactory
	{
		/// <summary>
		/// The path prefix used to identify a file as being contained in an archive.
		/// </summary>
		private const string ARCHIVE_PREFIX = "arch:";

		protected abstract IExtractor CreateExtractor(string p_strPath, bool p_booThreadSafe);
		protected abstract IExtractor CreateExtractor(Stream p_stmStream, bool p_booThreadSafe);
		protected abstract ICompressor CreateCompressor();

		public ICompressor GetCompressor()
		{
			return CreateCompressor();
		}

		public IExtractor GetExtractor(string p_strPath)
		{
			return GetExtractor(p_strPath, false);
		}

		public IExtractor GetThreadSafeExtractor(string p_strPath)
		{
			return GetExtractor(p_strPath, true);
		}

		/// <summary>
		/// Gets a <see cref="IExtractor"/> for the given path.
		/// </summary>
		/// <remarks>
		/// This builds a <see cref="IExtractor"/> for the given path. The path can
		/// be to a nested archive (an archive in another archive).
		/// </remarks> 
		/// <param name="p_strPath">The path to the archive for which to get a <see cref="SevenZipExtractor"/>.</param>
		/// <param name="p_booThreadSafe">Indicates if the returned extractor need to be thread safe.</param>
		/// <returns>A <see cref="IExtractor"/> for the given path if the extractor doesn't need to be
		/// thread safe; a <see cref="ThreadSafeSevenZipExtractor"/> otherwise.</returns>
		private IExtractor GetExtractor(string p_strPath, bool p_booThreadSafe)
		{
			if (p_strPath.StartsWith(ARCHIVE_PREFIX))
			{
				Stack<KeyValuePair<string, string>> stkFiles = new Stack<KeyValuePair<string, string>>();
				string strPath = p_strPath;
				while (strPath.StartsWith(ARCHIVE_PREFIX))
				{
					stkFiles.Push(Archive.ParseArchivePath(strPath));
					strPath = stkFiles.Peek().Key;
				}
				Stack<IExtractor> stkExtractors = new Stack<IExtractor>();
				try
				{
					KeyValuePair<string, string> kvpArchive = stkFiles.Pop();
					IExtractor szeArchive = CreateExtractor(kvpArchive.Key, false);
					stkExtractors.Push(szeArchive);
					for (; stkFiles.Count > 0; kvpArchive = stkFiles.Pop())
					{
						MemoryStream msmArchive = new MemoryStream();
						szeArchive.ExtractFile(kvpArchive.Value, msmArchive);
						msmArchive.Position = 0;
						szeArchive = CreateExtractor(msmArchive, false);
						stkExtractors.Push(szeArchive);
					}

					MemoryStream msmFile = new MemoryStream();
					szeArchive.ExtractFile(kvpArchive.Value, msmFile);
					msmFile.Position = 0;
					return CreateExtractor(msmFile, p_booThreadSafe);
				}
				finally
				{
					while (stkExtractors.Count > 0)
						stkExtractors.Pop().Dispose();
				}
			}
			else
			{
				return CreateExtractor(p_strPath, p_booThreadSafe);
			}
		}
	}
}
