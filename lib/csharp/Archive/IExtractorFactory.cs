namespace Archiving
{
	public interface IExtractorFactory
	{
		IExtractor GetExtractor(string p_strPath);
		IExtractor GetThreadSafeExtractor(string p_strPath);
		ICompressor GetCompressor();
	}
}
