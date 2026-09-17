declare module "@effront/core/application-entry" {
  const application: import("./application/definition").ApplicationDefinition<
    unknown,
    unknown,
    unknown
  >;

  export default application;
}
