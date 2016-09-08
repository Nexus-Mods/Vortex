using System;
using System.Collections.Generic;
using System.Runtime.Serialization;
using System.Security.Permissions;

namespace Util.Transactions
{
	/// <summary>
	/// An exception that is thrown when there is a problem rolling back a transaction.
	/// </summary>
	[Serializable]
	public class RollbackException : Exception
	{
		/// <summary>
		/// The resource manager that throw an exception.
		/// </summary>
		[Serializable]
		public class ExceptedResourceManager
		{
			/// <summary>
			/// Gets the resource manager that raised the exception.
			/// </summary>
			/// <value>The resource manager that raised the exception.</value>
			public IEnlistmentNotification ResourceManager { get; protected set; }

			/// <summary>
			/// Gets the exception raised by the resource manager.
			/// </summary>
			/// <value>The exception raised by the resource manager.</value>
			public Exception Exception { get; protected set; }

			/// <summary>
			/// A simple constructor that initializes the object with the given values.
			/// </summary>
			/// <param name="p_entResourceManager">The resource manager that raised the exception.</param>
			/// <param name="p_expException">The exception raised by the resource manager.</param>
			public ExceptedResourceManager(IEnlistmentNotification p_entResourceManager, Exception p_expException)
			{
				ResourceManager = p_entResourceManager;
				Exception = p_expException;
			}
		}

		/// <summary>
		/// Gets the list of resource managers that threw exceptions.
		/// </summary>
		/// <value>The list of resource managers that threw exceptions.</value>
		public IList<ExceptedResourceManager> ExceptedResourceManagers { get; protected set; }

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_lstExceptedResourceManagers">The list of resource managers that threw exceptions.</param>
		public RollbackException(IList<ExceptedResourceManager> p_lstExceptedResourceManagers)
		{
			ExceptedResourceManagers = p_lstExceptedResourceManagers;
		}


		[SecurityPermission(SecurityAction.Demand, SerializationFormatter = true)]
		public override void GetObjectData(SerializationInfo info, StreamingContext context)
		{
			base.GetObjectData(info, context);

			info.AddValue("resourceManagers", ExceptedResourceManagers);
		}
	}
}