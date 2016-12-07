using System;

namespace Nexus.Client.ModManagement.Scripting.XmlScript
{
	public abstract class VersionCondition : ICondition
	{
		#region Properties

		public Version MinimumVersion { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_verVersion">The minimum required version.</param>
		public VersionCondition(Version p_verVersion)
		{
			MinimumVersion = p_verVersion;
		}

		#endregion

		#region ICondition Members

		/// <summary>
		/// Gets whether or not the condition is fulfilled.
		/// </summary>
		/// <param name="p_csmStateManager">The manager that tracks the currect install state.</param>
		/// <returns><c>true</c> if the condition is fulfilled;
		/// <c>false</c> otherwise.</returns>
		public abstract bool GetIsFulfilled(ConditionStateManager p_csmStateManager);

		/// <summary>
		/// Gets a message describing whether or not the condition is fulfilled.
		/// </summary>
		/// <param name="p_csmStateManager">The manager that tracks the currect install state.</param>
		/// <returns>A message describing whether or not the condition is fulfilled.</returns>
		/// <seealso cref="ICondition.GetMessage(ConditionStateManager)"/>
		public abstract string GetMessage(ConditionStateManager p_csmStateManager);

		#endregion
	}
}
