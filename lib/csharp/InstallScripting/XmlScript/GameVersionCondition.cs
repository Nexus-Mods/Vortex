using System;

namespace Nexus.Client.ModManagement.Scripting.XmlScript
{
	/// <summary>
	/// A condition that requires a minimum version of the game to be installed.
	/// </summary>
	public class GameVersionCondition : VersionCondition
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_verVersion">The minimum required version of the game.</param>
		public GameVersionCondition(Version p_verVersion)
			: base(p_verVersion)
		{
		}

		#endregion

		/// <summary>
		/// Gets whether or not the condition is fulfilled.
		/// </summary>
		/// <remarks>
		/// The dependency is fulfilled if the specified minimum version of
		/// the game is installed.
		/// </remarks>
		/// <param name="p_csmStateManager">The manager that tracks the currect install state.</param>
		/// <returns><c>true</c> if the condition is fulfilled;
		/// <c>false</c> otherwise.</returns>
		/// <seealso cref="ICondition.GetIsFulfilled(ConditionStateManager)"/>
		public override bool GetIsFulfilled(ConditionStateManager p_csmStateManager)
		{
			Version verInstalledVersion = p_csmStateManager.GameVersion;
			return ((verInstalledVersion != null) && (verInstalledVersion >= MinimumVersion));
		}

		/// <summary>
		/// Gets a message describing whether or not the condition is fulfilled.
		/// </summary>
		/// If the dependency is fulfilled the message is "Passed." If the dependency is not fulfilled the
		/// message informs the user of the installed version.
		/// <param name="p_csmStateManager">The manager that tracks the currect install state.</param>
		/// <returns>A message describing whether or not the condition is fulfilled.</returns>
		/// <seealso cref="ICondition.GetMessage(ConditionStateManager)"/>
		public override string GetMessage(ConditionStateManager p_csmStateManager)
		{
			Version verInstalledVersion = p_csmStateManager.GameVersion;
			if (verInstalledVersion < MinimumVersion)
				return String.Format("This mod requires v{0} or higher of the game. You have {1}. Please update your game.", MinimumVersion, verInstalledVersion);
			return "Passed";
		}
	}
}
