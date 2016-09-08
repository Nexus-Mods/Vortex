using System;
using System.Runtime.Serialization;

namespace Scripting
{
	/// <summary>
	/// The exception that is thrown when the path being accessed is illegal.
	/// </summary>
	[Serializable]
	public class IllegalFilePathException : Exception
	{
		private string m_strPath = null;

		/// <summary>
		/// Gets the illegal path.
		/// </summary>
		/// <value>The illegal path.</value>
		public string Path
		{
			get
			{
				return m_strPath;
			}
		}

		/// <summary>
		/// The default constructor.
		/// </summary>
		/// <param name="p_strPath">The illegal path.</param>
		public IllegalFilePathException(string p_strPath)
		{
			m_strPath = p_strPath;
		}

		/// <summary>
		/// A simple contructor that sets the exception's message.
		/// </summary>
		/// <param name="p_strPath">The illegal path.</param>
		/// <param name="message">The exception's message.</param>
		public IllegalFilePathException(string p_strPath, string message)
			: base(message)
		{
			m_strPath = p_strPath;
		}

		/// <summary>
		/// A simple constructor the sets the exception's message and inner exception.
		/// </summary>
		/// <param name="p_strPath">The illegal path.</param>
		/// <param name="message">The exception's message.</param>
		/// <param name="inner">The ineer exception.</param>
		public IllegalFilePathException(string p_strPath, string message, Exception inner)
			: base(message, inner)
		{
			m_strPath = p_strPath;
		}


		public override void GetObjectData(SerializationInfo info, StreamingContext context)
		{
			if (info == null)
				throw new ArgumentNullException("info");

			base.GetObjectData(info, context);

			info.AddValue("path", m_strPath);
		}
	}
}
