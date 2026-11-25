declare module "@effront/core/application-entry" {
  // oxlint-disable-next-line typescript/consistent-type-imports -- Refer to the relative definition type without converting this ambient file to a module.
  const application: import("./application/definition").ApplicationDefinition<
    unknown,
    unknown,
    unknown
  >;

  export default application;
}
