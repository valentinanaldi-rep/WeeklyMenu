describe('Weekly Menu smoke', () => {
  it('renders the app and its week view', () => {
    cy.visit('/')
    cy.contains('Weekly Menu')
    cy.get('[data-testid="week-range"]').should('exist')
    cy.get('[data-testid="prev-week"]').should('exist')
    cy.get('[data-testid="next-week"]').should('exist')
    cy.get('[data-testid="lunch-0"]').should(exist => {
      expect((exist[0] as HTMLElement).textContent).to.contain('Pranzo')
    })
    cy.get('[data-testid="edit-pencil"]').should('exist')
  })

  it('enters edit mode and cancels without writing', () => {
    cy.visit('/')
    cy.get('[data-testid="edit-pencil"]').click()
    cy.get('[data-testid="edit-save"]').should('exist')
    cy.get('[data-testid="edit-cancel"]').should('exist')
    cy.get('[data-testid="lunch-0"]').then(el => {
      expect((el[0] as HTMLElement).tagName).to.eq('TEXTAREA')
    })
    cy.get('[data-testid="edit-cancel"]').click()
    cy.get('[data-testid="edit-pencil"]').should('exist')
  })
})