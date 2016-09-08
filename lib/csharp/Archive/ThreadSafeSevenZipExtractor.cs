using SevenZip;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Threading;
using Util.Threading;

namespace Archiving
{
	/// <summary>
	/// A wrapper for the <see cref="SevenZipExtractor"/> class that makes using it
	/// thread safe.
	/// </summary>
	public class ThreadSafeSevenZipExtractor : IExtractor, IDisposable
	{
		/// <summary>
		/// Encapsulates an action that the thread safe extractor is asked to execute.
		/// </summary>
		private class ActionPackage
		{
			#region Properties

			/// <summary>
			/// Gets the event that notifies the requester when the action has completed.
			/// </summary>
			/// <value>The event that notifies the requester when the action has completed.</value>
			public ManualResetEvent DoneEvent { get; private set; }

			/// <summary>
			/// Gets the action to execute.
			/// </summary>
			/// <value>The action to execute.</value>
			public Action Action { get; private set; }

			/// <summary>
			/// Gets or sets the exception that was caught while executing the action.
			/// </summary>
			/// <value>The exception that was caught while executing the action.</value>
			public Exception Exception { get; set; }

			#endregion

			#region Constructors

			/// <summary>
			/// A simple constructor that initializes the object with the given values.
			/// </summary>
			/// <param name="p_actAction">The action to execute.</param>
			public ActionPackage(Action p_actAction)
			{
				Action = p_actAction;
				DoneEvent = new ManualResetEvent(false);
			}

			#endregion.s
		}

		private TrackedThread m_thdExtractor = null;
		private Queue<ActionPackage> m_queEvents = null;
		private ManualResetEvent m_mreEvent = null;
		private SevenZipExtractor m_szeExtractor = null;
		private string m_strPath = null;
		private Stream m_stmArchive = null;

		public event EventHandler<ProgressEventArgs> Extracting;
		public event EventHandler<EventArgs> ExtractionFinished;
		public event EventHandler<FileOverwriteEventArgs> FileExists;
		public event EventHandler<FileInfoEventArgs> FileExtractionFinished;
		public event EventHandler<FileInfoEventArgs> FileExtractionStarted;

		#region Properties

		/// <summary>
		/// Gets the <see cref="SevenZipExtractor"/> that is being made thread safe.
		/// </summary>
		/// <value>The <see cref="SevenZipExtractor"/> that is being made thread safe.</value>
		public SevenZipExtractor Extractor
		{
			get
			{
				return m_szeExtractor;
			}
		}

		/// <summary>
		/// Gets the list of data describing the files in the archive.
		/// </summary>
		/// <remarks>
		/// This wrapper property ensures the operation executes on the same thread in which the
		/// <see cref="SevenZipExtractor"/> was created.
		/// </remarks>
		/// <value>The list of data describing the files in the archive.</value>
		/// <seealso cref="SevenZipExtractor.ArchiveFileData"/>
		public ReadOnlyCollection<ArchiveFileInfo> ArchiveFileData
		{
			get
			{
				ReadOnlyCollection<ArchiveFileInfo> rocFileInfo = null;
				ExecuteAction(() => { rocFileInfo = m_szeExtractor.ArchiveFileData; });
				return rocFileInfo;
			}
		}

		/// <summary>
		/// Gets whether the archive is solid.
		/// </summary>
		/// <remarks>
		/// This wrapper property ensures the operation executes on the same thread in which the
		/// <see cref="SevenZipExtractor"/> was created.
		/// </remarks>
		/// <value><c>true</c> if the archive is solid; <c>false</c> otherwise.</value>
		/// <seealso cref="SevenZipExtractor.IsSolid"/>
		public bool IsSolid
		{
			get
			{
				bool booIsSolid = false;
				ExecuteAction(() => { booIsSolid = m_szeExtractor.IsSolid; });
				return booIsSolid;
			}
		}

		public ReadOnlyCollection<string> ArchiveFileNames
		{
			get
			{
				return m_szeExtractor.ArchiveFileNames;
			}
		}

		public ReadOnlyCollection<ArchiveProperty> ArchiveProperties
		{
			get
			{
				return m_szeExtractor.ArchiveProperties;
			}
		}

		public string FileName
		{
			get
			{
				return m_szeExtractor.FileName;
			}
		}

		public uint FilesCount
		{
			get
			{
				return m_szeExtractor.FilesCount;
			}
		}

		public InArchiveFormat Format
		{
			get
			{
				return m_szeExtractor.Format;
			}
		}

		public long PackedSize
		{
			get
			{
				return m_szeExtractor.PackedSize;
			}
		}

		public bool PreserveDirectoryStructure
		{
			get
			{
				return m_szeExtractor.PreserveDirectoryStructure;
			}

			set
			{
				m_szeExtractor.PreserveDirectoryStructure = value;
			}
		}

		public long UnpackedSize
		{
			get
			{
				return m_szeExtractor.UnpackedSize;
			}
		}

		public ReadOnlyCollection<string> VolumeFileNames
		{
			get
			{
				return m_szeExtractor.VolumeFileNames;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// Creates a thread safe extractor for the file at the given path.
		/// </summary>
		/// <param name="p_strPath">The path to the file for which to create an extractor.</param>
		public ThreadSafeSevenZipExtractor(string p_strPath)
		{
			m_strPath = p_strPath;
			Init();
		}

		/// <summary>
		/// Creates a thread safe extractor for the given stream.
		/// </summary>
		/// <param name="p_stmArchive">The stream for which to create an extractor.</param>
		public ThreadSafeSevenZipExtractor(Stream p_stmArchive)
		{
			m_stmArchive = p_stmArchive;
			Init();
		}

		/// <summary>
		/// Initializes the thread safe extractor.
		/// </summary>
		protected void Init()
		{
			m_queEvents = new Queue<ActionPackage>();
			m_mreEvent = new ManualResetEvent(false);
			m_thdExtractor = new TrackedThread(RunThread);
			m_thdExtractor.Thread.IsBackground = false;
			m_thdExtractor.Thread.Name = "Seven Zip Extractor";

			ActionPackage apkStart = new ActionPackage(null);
			m_queEvents.Enqueue(apkStart);
			m_thdExtractor.Start();
			apkStart.DoneEvent.WaitOne();
		}

		#endregion

		/// <summary>
		/// Executes the given action.
		/// </summary>
		/// <remarks>
		/// This method:
		/// 1) Enqueues the action in the work queue.
		/// 2) Notifies the extraction thread that there is work to do.
		/// 3) Waits to be notified that the action has completed.
		/// 4) Throws any exception that was raised while executing the action.
		/// </remarks>
		/// <param name="p_actAction">The action to get the extractor to execute.</param>
		protected void ExecuteAction(Action p_actAction)
		{
			ActionPackage apkAction = new ActionPackage(p_actAction);
			m_queEvents.Enqueue(apkAction);
			m_mreEvent.Set();
			apkAction.DoneEvent.WaitOne();
			if (apkAction.Exception != null)
				throw apkAction.Exception;
		}

		/// <summary>
		/// The run method of the thread on which the <see cref="SevenZipExtractor"/> is created.
		/// </summary>
		/// <remarks>
		/// This method creates a <see cref="SevenZipExtractor"/> and then watches for events to execute.
		/// Other methods signal the thread that an action needs to be taken, and this thread executes said
		/// actions.
		/// </remarks>
		protected void RunThread()
		{
			m_szeExtractor = String.IsNullOrEmpty(m_strPath) ? new SevenZipExtractor(m_stmArchive)
															 : new SevenZipExtractor(m_strPath);

			m_szeExtractor.Extracting += Extracting;
			m_szeExtractor.ExtractionFinished += ExtractionFinished;
			m_szeExtractor.FileExists += FileExists;
			m_szeExtractor.FileExtractionFinished += FileExtractionFinished;
			m_szeExtractor.FileExtractionStarted += FileExtractionStarted;

			try
			{
				ActionPackage apkStartEvent = m_queEvents.Dequeue();
				apkStartEvent.DoneEvent.Set();
				while (true)
				{
					m_mreEvent.WaitOne();
					ActionPackage apkEvent = m_queEvents.Dequeue();
					if (apkEvent.Action == null)
						break;
					try
					{
						apkEvent.Action();
					}
					catch (Exception e)
					{
						apkEvent.Exception = e;
					}
					m_mreEvent.Reset();
					apkEvent.DoneEvent.Set();
				}
			}
			finally
			{
				m_szeExtractor.Dispose();
			}
		}

		/// <summary>
		/// Extracts the specified file to the given stream.
		/// </summary>
		/// <remarks>
		/// This wrapper property ensures the operation executes on the same thread in which the
		/// <see cref="SevenZipExtractor"/> was created.
		/// </remarks>
		/// <param name="p_intIndex">The index of the file to extract from the archive.</param>
		/// <param name="p_stmFile">The stream to which to extract the file.</param>
		public void ExtractFile(Int32 p_intIndex, Stream p_stmFile)
		{
			ExecuteAction(() => { m_szeExtractor.ExtractFile(p_intIndex, p_stmFile); });
		}


		public void BeginExtractArchive(string directory)
		{
			m_szeExtractor.BeginExtractArchive(directory);
		}

		public void BeginExtractFile(string fileName, Stream stream)
		{
			m_szeExtractor.BeginExtractFile(fileName, stream);
		}

		public void BeginExtractFile(int index, Stream stream)
		{
			m_szeExtractor.BeginExtractFile(index, stream);
		}

		public void BeginExtractFiles(ExtractFileCallback extractFileCallback)
		{
			m_szeExtractor.BeginExtractFiles(extractFileCallback);
		}

		public void BeginExtractFiles(string path, params string[] fileNames)
		{
			m_szeExtractor.BeginExtractFiles(path, fileNames);
		}

		public void BeginExtractFiles(string path, params int[] indexes)
		{
			m_szeExtractor.BeginExtractFiles(path, indexes);
		}

		public bool Check()
		{
			return m_szeExtractor.Check();
		}

		public void ExtractArchive(string path)
		{
			m_szeExtractor.ExtractArchive(path);
		}

		public void ExtractFile(string fileName, Stream stream)
		{
			m_szeExtractor.ExtractFile(fileName, stream);
		}

		public void ExtractFiles(ExtractFileCallback extractFileCallback)
		{
			m_szeExtractor.ExtractFiles(extractFileCallback);
		}

		public void ExtractFiles(string path, params int[] indexes)
		{
			m_szeExtractor.ExtractFiles(path, indexes);
		}

		public void ExtractFiles(string path, params string[] fileNames)
		{
			m_szeExtractor.ExtractFiles(path, fileNames);
		}


		#region IDisposable Members

		/// <summary>
		/// Ensures all used resources are released.
		/// </summary>
		/// <remarks>
		/// This terminates the thread upon which the <see cref="SevenZipExtractor"/> was created.
		/// </remarks>
		protected virtual void Dispose(bool disposing)
		{
			if (disposing)
			{
				m_queEvents.Enqueue(new ActionPackage(null));
				m_mreEvent.Set();
				m_thdExtractor.Thread.Join();
				m_mreEvent.Dispose();
			}
		}

		public void Dispose()
		{
			Dispose(true);
		}

		#endregion
	}
}
