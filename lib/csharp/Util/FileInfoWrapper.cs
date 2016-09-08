using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Util
{
	class FileInfoWrapper : IFileInfo
	{
		private FileInfo m_fiWrappee;

		public FileInfoWrapper(string p_strFilePath)
		{
			m_fiWrappee = new FileInfo(p_strFilePath);
		}

		public FileAttributes Attributes
		{
			get
			{
				return m_fiWrappee.Attributes;
			}
		}

		public bool IsReadOnly
		{
			get
			{
				return m_fiWrappee.IsReadOnly;
			}
		}
	}
}
