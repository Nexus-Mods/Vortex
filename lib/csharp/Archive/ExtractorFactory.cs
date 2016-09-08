using System.IO;

namespace Archiving
{
	class ExtractorFactory : ExtractorFactoryBase
	{
		public ExtractorFactory()
		{
		}

		protected override ICompressor CreateCompressor()
		{
			return new SevenZipCompressorWrapper();
		}

		protected override IExtractor CreateExtractor(string p_strPath, bool p_booThreadSafe)
		{
			if (p_booThreadSafe)
			{
				return new ThreadSafeSevenZipExtractor(p_strPath);
			}
			else
			{
				return new SevenZipExtractorWrapper(p_strPath);
			}
		}

		protected override IExtractor CreateExtractor(Stream p_stmStream, bool p_booThreadSafe)
		{
			if (p_booThreadSafe)
			{
				return new ThreadSafeSevenZipExtractor(p_stmStream);
			}
			else
			{
				return new SevenZipExtractorWrapper(p_stmStream);
			}
		}
	}
}
