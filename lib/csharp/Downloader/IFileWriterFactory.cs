namespace Downloader
{
	public interface IFileWriterFactory
    {
        IFileWriter Create(string p_strFilePath, string p_strFileMetadataPath);
    }
}
