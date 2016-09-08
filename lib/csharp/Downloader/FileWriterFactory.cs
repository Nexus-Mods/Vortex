namespace Downloader
{
	public class FileWriterFactory : IFileWriterFactory
    {
        public IFileWriter Create(string p_strFilePath, string p_strFileMetadataPath)
        {
            return new FileWriter(p_strFilePath, p_strFileMetadataPath);
        }
    }
}
